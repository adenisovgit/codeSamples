import { defer, isEqual, noop } from 'lodash';
import * as PropTypes from 'prop-types';
import React, { createRef } from 'react';
import { withTranslation } from 'react-i18next';

import RichTextEditor from '@organisms/RichTextEditor';
import {
  align as alignKey,
  blockBackground as blockBackgroundKey,
  borderColor as borderColorKey,
  borderDashArray as borderDashArrayKey,
  color as colorKey,
  formatsSchemaUFText,
  size as sizeKey,
} from '@organisms/RichTextEditor/variables';
import {
  BLOCK_TEXT,
  defaultBlockPaddingMap,
  notBoundCellSize,
  textBlockBackgroundPaddings,
} from '@organisms/UserflowSchema/variables';

import { getBBoxSize } from '@utils/BBox';
import ceilTo from '@utils/Math/partialCeil';

import { DEPARTURE_ID, DESTINATION_ID } from '@store/Lines/variables';
import {
  ALIGN,
  BACKGROUND_COLOR,
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  BLOCK_X,
  BLOCK_Y,
  BORDER_COLOR,
  DASH_ARRAY,
  PARAM,
  QUILL_TEXT,
  SIZE,
  TEXT_COLOR,
} from '@store/UserflowBlocks/variables';

import { textGray } from '@variables/colors';

import { baseClassName } from './classNames';

const NONE = 'none';

const emptyTextState = {
  ops: [
    {
      insert: '\n',
    },
  ],
};

const blockBackgroundPaddings = textBlockBackgroundPaddings;

const blockPaddingsWidth = defaultBlockPaddingMap[BLOCK_TEXT].width;
const blockPaddingsHeight = defaultBlockPaddingMap[BLOCK_TEXT].height;
const globalFormats = [
  colorKey,
  sizeKey,
  alignKey,
  blockBackgroundKey,
  borderColorKey,
  borderDashArrayKey,
];

class UFText extends React.Component {
  constructor(props) {
    super(props);
    this.editorContainerRef = createRef();
    this.textEditorRef = createRef();
    this.textWrapper = null;
    this.oldEditorHeight = 0;

    const { [PARAM]: param } = props;

    const {
      [QUILL_TEXT]: currentText,
      [BACKGROUND_COLOR]: backgroundColor = NONE,
      [BORDER_COLOR]: borderColor = NONE,
      [DASH_ARRAY]: dashArray,
      [TEXT_COLOR]: color = textGray,
      [ALIGN]: align = 'left',
      [SIZE]: size = 14,
    } = param;

    this.quill = null;
    this.editor = null;
    this.shouldUseInternalPaddings = null;
    this.innerBBoxShift = null;

    this.state = {
      isEditing: false,
    };
    this.textState = currentText;
    this.formatsState = {
      backgroundColor,
      borderColor,
      dashArray,
      color,
      align,
      size,
    };
  }

  componentDidMount() {
    this.textWrapper = this.textEditorRef.current && this.textEditorRef.current.rootNodeRef.current;
    this.quill = this.textEditorRef && this.textEditorRef.current;
    this.editor = this.quill && this.quill.quillEditor;

    const noEditor = !this.quill || !this.editor;
    if (noEditor) return;
    this.editor.root.addEventListener('mousedown', this.mouseDownCallback, true);
    this.firstRender = true;
  }

  componentDidUpdate(prevProps) {
    const {
      width: prevWidth,
      height: prevHeight,
      blockWrapperY: prevY,
      isResizing: prevIsResizing,
      [PARAM]: prevParam,
    } = prevProps;
    const {
      width,
      height,
      blockWrapperY: y,
      [PARAM]: param,
      isResizing,
      setTemporaryResizingState,
    } = this.props;

    if (!isEqual(param, prevParam)) {
      const {
        [QUILL_TEXT]: newText,
        [BACKGROUND_COLOR]: backgroundColor = NONE,
        [BORDER_COLOR]: borderColor = NONE,
        [DASH_ARRAY]: dashArray,
        [TEXT_COLOR]: color = textGray,
        [ALIGN]: align = 'left',
        [SIZE]: size = 14,
      } = param;

      this.formatsState = {
        backgroundColor,
        borderColor,
        dashArray,
        color,
        align,
        size,
      };

      this.textState = newText;
      this.forceUpdate();
    }
    if (prevWidth !== width || prevHeight !== height || prevY < y) {
      this.updateSizeOnResize({ y, prevY });
    }

    if (prevIsResizing && !isResizing) {
      setTemporaryResizingState({ height: null, y: null });
    }
    if (this.firstRender) {
      this.firstRender = false;
      this.updateSizeOnTextEnter();
    }
  }

  componentWillUnmount() {
    this.editor.root.removeEventListener('mousedown', this.mouseDownCallback);
  }

  focusEditor = () => {
    if (this.textEditorRef.current && this.textEditorRef.current.quillEditor) {
      this.textEditorRef.current.focusAtEnd();
      return true;
    }
    return false;
  };

  postCreateAction = () => {
    return this.focusEditor();
  };

  getIsBackgroundOrBorderExist = () => {
    const {
      [PARAM]: { [BACKGROUND_COLOR]: backgroundColor = NONE, [BORDER_COLOR]: borderColor = NONE },
    } = this.props;
    const isBackgroundExist = !!backgroundColor && backgroundColor !== NONE;
    const isBorderExist = !!borderColor && borderColor !== NONE;
    const isBackgroundOrBorderExist = isBackgroundExist || isBorderExist;
    return { isBackgroundOrBorderExist, isBackgroundExist, isBorderExist };
  };

  getInnerBBox = () => {
    const {
      innerBBox,
      isResizing,
      width,
      height,
      blockID,
      getBlockStateWithProps,
      [BLOCK_X]: propsX,
      [BLOCK_Y]: propsY,
    } = this.props;

    if (!isResizing) {
      return innerBBox;
    }

    const tempBlockState = getBlockStateWithProps(
      blockID,
      {
        [BLOCK_WIDTH]: width,
        [BLOCK_HEIGHT]: height,
        [BLOCK_X]: propsX,
        [BLOCK_Y]: propsY,
      },
      true,
    );

    const { innerBBox: tempInnerBBox } = tempBlockState;
    return tempInnerBBox;
  };

  getContentBoxSize = () => {
    const innerBBox = this.getInnerBBox();

    const { width, height } = getBBoxSize(innerBBox);
    const { isBackgroundOrBorderExist } = this.getIsBackgroundOrBorderExist();
    const contentHeight = isBackgroundOrBorderExist ? height - blockBackgroundPaddings * 2 : height;
    const contentWidth = isBackgroundOrBorderExist ? width - blockBackgroundPaddings * 2 : width;
    return { width: contentWidth, height: contentHeight };
  };

  updateSizeOnTextEnter = () => {
    if (!this.textWrapper) {
      return;
    }
    const { onChangeWidthHeight, height } = this.props;

    const { clientHeight: editorHeight } = this.textWrapper;

    const newBlockHeightRequest = ceilTo(
      editorHeight + defaultBlockPaddingMap[BLOCK_TEXT].height * 2 + blockBackgroundPaddings * 2,
      notBoundCellSize.height,
    );

    const shouldFollowContentHeight =
      this.oldEditorHeight === height || newBlockHeightRequest > height;

    this.oldEditorHeight = newBlockHeightRequest;
    if (shouldFollowContentHeight && newBlockHeightRequest !== height) {
      // eslint-disable-next-line no-unused-expressions
      onChangeWidthHeight && onChangeWidthHeight({ height: newBlockHeightRequest });
    }
  };

  updateSizeOnResize = ({ y, prevY }) => {
    if (!this.textWrapper) {
      return;
    }

    const { height, setTemporaryResizingState } = this.props;

    const { clientHeight: editorHeight } = this.textWrapper;

    const { isBackgroundOrBorderExist } = this.getIsBackgroundOrBorderExist();

    const newBlockHeightRequest = ceilTo(
      editorHeight +
        defaultBlockPaddingMap[BLOCK_TEXT].height * 2 +
        (isBackgroundOrBorderExist ? blockBackgroundPaddings * 2 : 0),
      notBoundCellSize.height,
    );

    const updateHeight = height > newBlockHeightRequest ? null : newBlockHeightRequest;
    const updateY = updateHeight && prevY < y ? prevY : null;
    setTemporaryResizingState({ height: updateHeight, y: updateY });
  };

  handleMouseDown = (event) => {
    const { onClick, isFocused } = this.props;
    if (!isFocused) {
      event.preventDefault();
    }
    // eslint-disable-next-line no-unused-expressions
    onClick && onClick(event);
  };

  mouseDownCallback = (event) => {
    const { isEditing } = this.state;
    if (isEditing) {
      event.stopPropagation();
    }
  };

  isTextStateEmpty = () => !this.textState || isEqual(this.textState, emptyTextState);

  isConnectedToLines = () => {
    const { linesMap, blockID } = this.props;
    const lines = Object.values(linesMap);
    const connectedLines = lines.filter(
      (line) => line[DESTINATION_ID] === blockID || line[DEPARTURE_ID] === blockID,
    );
    return connectedLines.length > 0;
  };

  handleFocus = () => this.setState({ isEditing: true });

  handleBlur = () => {
    const { onChangeParam, onDelete, blockID, [PARAM]: param } = this.props;

    const {
      [QUILL_TEXT]: currentText,
      [BACKGROUND_COLOR]: backgroundColor = NONE,
      [BORDER_COLOR]: borderColor = NONE,
      [DASH_ARRAY]: dashArray,
      [TEXT_COLOR]: color = textGray,
      [ALIGN]: align = 'left',
      [SIZE]: size = 14,
    } = param;

    const initialFormatsState = {
      [BACKGROUND_COLOR]: backgroundColor,
      [BORDER_COLOR]: borderColor,
      [DASH_ARRAY]: dashArray,
      [TEXT_COLOR]: color,
      [ALIGN]: align,
      [SIZE]: size,
    };

    const isTextChanged = !isEqual(currentText, this.textState);
    const isFormatsChanged = !isEqual(initialFormatsState, this.formatsState);
    const isTextStateEmpty = this.isTextStateEmpty();

    if (
      typeof onChangeParam === 'function' &&
      (isTextChanged || isFormatsChanged) &&
      !isTextStateEmpty
    ) {
      onChangeParam({
        [QUILL_TEXT]: this.textState,
        [BACKGROUND_COLOR]: this.formatsState.backgroundColor,
        [BORDER_COLOR]: this.formatsState.borderColor,
        [DASH_ARRAY]: this.formatsState.dashArray,
        [TEXT_COLOR]: this.formatsState.color,
        [ALIGN]: this.formatsState.align,
        [SIZE]: this.formatsState.size,
      });
    }
    if (isTextStateEmpty) {
      const isLinesConnected = this.isConnectedToLines();
      if (!isLinesConnected) {
        defer(onDelete, [blockID]);
      }
    }
    this.setState({ isEditing: false });
  };

  onChangeTextDelta = (newTextDelta) => {
    this.updateSizeOnTextEnter();
    this.textState = newTextDelta;
  };

  handleChangeFormat = (formatName, formatValue) => {
    const isChanged = this.formatsState[formatName] !== formatValue;
    if (!isChanged) {
      return;
    }
    const { onChangeParam } = this.props;

    this.formatsState = {
      ...this.formatsState,
      [formatName]: formatValue,
    };
    onChangeParam({
      [BACKGROUND_COLOR]: this.formatsState.backgroundColor,
      [BORDER_COLOR]: this.formatsState.borderColor,
      [DASH_ARRAY]: this.formatsState.dashArray,
      [TEXT_COLOR]: this.formatsState.color,
      [ALIGN]: this.formatsState.align,
      [SIZE]: this.formatsState.size,
    });

    this.updateSizeOnTextEnter();
  };

  setQuillFocus = () => {
    if (!this.textEditorRef.current.quillEditor.getSelection()) {
      setTimeout(() => {
        this.textEditorRef.current.focusAtEnd();
      }, 0);
    }
  };

  render() {
    const {
      t,
      isFocused,
      [PARAM]: {
        [BACKGROUND_COLOR]: backgroundColor = NONE,
        [BORDER_COLOR]: borderColor = NONE,
        [DASH_ARRAY]: dashArray,
      },
    } = this.props;

    const {
      isBackgroundOrBorderExist,
      isBackgroundExist,
      isBorderExist,
    } = this.getIsBackgroundOrBorderExist();

    const blockPositionStyle = {
      transform: `translate(${blockPaddingsWidth}px, ${blockPaddingsHeight}px)`,
    };

    const innerBBox = this.getInnerBBox();
    const { width, height } = getBBoxSize(innerBBox);
    const { width: contentWidth, height: contentHeight } = this.getContentBoxSize();

    const contentPositionStyle = isBackgroundOrBorderExist
      ? {}
      : {
          transform: `translate(${blockBackgroundPaddings}px, ${blockBackgroundPaddings}px)`,
        };

    const strokeWidth = isFocused ? 4 : 2;
    return (
      <g
        onMouseDownCapture={this.handleMouseDown}
        style={blockPositionStyle}
        className={baseClassName}
      >
        <rect
          ref={this.editorContainerRef}
          width={width}
          height={height}
          fill={isBackgroundExist ? backgroundColor : 'none'}
          strokeWidth={isBorderExist ? strokeWidth : 0}
          stroke={borderColor}
          strokeDasharray={dashArray}
          style={contentPositionStyle}
        />
        <foreignObject
          width={contentWidth}
          height={contentHeight}
          x={blockBackgroundPaddings}
          y={blockBackgroundPaddings}
        >
          <RichTextEditor
            ref={this.textEditorRef}
            formatsSchema={formatsSchemaUFText}
            value={this.textState}
            globalFormatsState={this.formatsState}
            globalFormats={globalFormats}
            onFocus={this.handleFocus}
            onBlur={this.handleBlur}
            onChange={this.onChangeTextDelta}
            onFormatChange={this.handleChangeFormat}
            onInput={this.onChangeTextDelta}
            readOnly={!isFocused}
            placeholder={t('createBlockModal.blocks.Text.emptyPlaceholder')}
            toolbarFixed
            toolbarFixationRef={this.editorContainerRef}
            data-cy="uf-rich-text"
            // updateWhileFocused
          />
        </foreignObject>
      </g>
    );
  }
}

UFText.displayName = 'UFText';

UFText.defaultProps = {
  blockID: '',
  isFocused: false,
  isEditable: false,
  isResizing: false,
  width: 0,
  height: 0,
  blockWrapperX: 0,
  blockWrapperY: 0,
  onClick: noop,
  onChangeParam: noop,
  onChangeWidthHeight: noop,
  setTemporaryResizingState: noop,
  onDelete: noop,
  t: noop,
  linesMap: {},
  innerBBox: null,
  getBlockStateWithProps: noop,
};

UFText.propTypes = {
  blockID: PropTypes.string,
  isFocused: PropTypes.bool,
  isEditable: PropTypes.bool,
  isResizing: PropTypes.bool,
  width: PropTypes.number,
  height: PropTypes.number,
  blockWrapperX: PropTypes.number,
  blockWrapperY: PropTypes.number,
  onClick: PropTypes.func,
  onChangeParam: PropTypes.func,
  onChangeWidthHeight: PropTypes.func,
  setTemporaryResizingState: PropTypes.func,
  onDelete: PropTypes.func,
  t: PropTypes.func,
  // eslint-disable-next-line react/forbid-prop-types
  linesMap: PropTypes.object,
  innerBBox: PropTypes.shape({
    top: PropTypes.number,
    bottom: PropTypes.number,
    left: PropTypes.number,
    right: PropTypes.number,
  }),
  getBlockStateWithProps: PropTypes.func,
};

export default withTranslation('', { withRef: true })(UFText);
