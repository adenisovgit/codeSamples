// noinspection DuplicatedCode

import { difference, intersection, isEmpty, isEqual, mapValues, throttle } from 'lodash';

import { unwrapResult } from '@reduxjs/toolkit';

import { FMGrid } from '@legacy/utils/FMGrid';
import {
  replaceXBoundingBoxValues,
  replaceYBoundingBoxValues,
} from '@legacy/utils/FMGrid/gridToolkit';

import { DEPARTURE, edgeProps } from '@blocks/UserflowBlocks/UFLine/variables';

import {
  applyBBoxShift,
  concatBBox,
  findBBoxIntersectBBoxes,
  getBBox,
  getBBoxCenter,
  getBBoxSizeAndCoord,
  isBBoxIntersectBBoxes,
} from '@utils/BBox';
import createBBoxByCorners from '@utils/BBox/createBBoxByCorners';
// import { getBBoxArea } from '@utils/BBox/getBBoxArea';
import { isBBoxContain } from '@utils/BBox/isBBoxContain';
import isPointInsideBBox from '@utils/BBox/isPointInsideBBox';
import { addEventListener, appendChildren, createElement, setAttributes } from '@utils/DOM';
import KeyboardBinding from '@utils/DOM/KeyboardBinding';
import getScaledImageDimensions from '@utils/image/getScaledImageDimentions';
import distanceBetweenPoints from '@utils/Math/distanceBetweenPoints';
import PathFinder from '@utils/PathFinder';
import { wrapChangeRequest } from '@utils/store/generateStores/createActions/utils/changeWrapper';
import createSvg from '@utils/Svg/createSvg';

import { TEXT_BLOCK } from '@store/ContentSystemBlocks/variables';
// import getPromiseDelay from '@utils/time/getPromiseDelay';
import {
  COLOR,
  DASH_ARRAY,
  DEPARTURE_CONNECTOR_TYPE,
  DEPARTURE_EDGE,
  DEPARTURE_ID,
  DESTINATION_CONNECTOR_TYPE,
  DESTINATION_EDGE,
  DESTINATION_ID,
  ICON,
  ICON_POSITION,
  INTERMEDIATE_POINTS,
  LINE_ID,
  TEMPORARY as TEMPORARY_LINE,
} from '@store/Lines/variables';
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  BLOCK_X,
  BLOCK_Y,
  BOTTOM,
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  LEFT,
  PARAM,
  RIGHT,
  TEMPORARY as TEMPORARY_BLOCK,
  TEMPORARY_IMAGE_LINK,
  TOP,
  TYPE,
  USERFLOW_BLOCK_ID,
} from '@store/UserflowBlocks/variables';

import { gray, promoBlue } from '@variables/colors';
import { transitionLong } from '@variables/transitions';

import {
  BLOCK_BACKGROUND,
  BLOCK_CJM,
  BLOCK_FIGURE,
  BLOCK_IMAGE,
  BLOCK_PERSONA,
  BLOCK_SITEMAP_PAGE,
  BLOCK_TEXT,
  blockCreatorSizeInCells,
  blockSortingMap,
  dragDirectionToCursorMap,
  dragDirectionToEdgesMap,
  dragDirectionToSignMap,
  edgeToAxis,
  gridCellSize,
  maximumBlockSizeMap,
  minimumBlockSizeMap,
  movingConnectorCircleRadius,
  notBoundCellSize,
  offGridTypes,
  overlapNonAffectedTypes,
  pathFindingScalingCoefficient,
  reverseEdge,
  scaleSettings,
} from '../variables';

export default class UserflowRender {
  constructor(node, settings) {
    const {
      onZoomChange,
      onMoveViewBox,
      blockCreatorNode,
      blockCreatorRef,
      lineCreatorRef,
      lineCreatorNode,
      focusedBlocksIDs,
      handleSelectBlocksArray,
      handleClearFocus,
      selectionBoxNode,
      selectionBoxRef,
      isDragging,
      // onDragStart,
      handleCreateBlocks,
      attachImagesToUserflowBlocksByLinks,
      handleChangeBlocks,
      handleRemoveUserflowBlocks,
      handleCreateLine,
      handleChangeLine,
      handleUpdateLine,
      // schemaRender,
      isEditable,
      isCommentsModeEnabled,
      // handleAddLines,
      handleRemoveLines,
    } = settings;

    this.scale = 1;
    this.blocksMap = {};
    this.linesMap = {};
    this.requestedRenderTarget = null;
    this.params = {
      isEditable: true,
      gridSize: {},
    };
    this.resizeTimeout = null;

    this.isDragging = isDragging;
    this.isEditable = isEditable;
    this.isCommentsModeEnabled = isCommentsModeEnabled;
    this.isPasting = false;
    this.blockFlashTimer = null;

    this.dragData = null;
    // this.onDragStart = onDragStart;
    this.handleChangeBlocks = handleChangeBlocks;
    this.handleCreateBlocks = handleCreateBlocks;
    this.attachImagesToUserflowBlocksByLinks = attachImagesToUserflowBlocksByLinks;
    this.handleRemoveUserflowBlocks = handleRemoveUserflowBlocks;

    // this.handleAddLines = handleAddLines;
    this.handleRemoveLines = handleRemoveLines;
    this.backgroundsToAcceptItems = [];

    this.isCreatingLine = false;
    this.isHoverLine = false;

    this.node = node;
    this.search = null;

    this.focusedBlocksIDs = focusedBlocksIDs;
    this.handleSelectBlocksArray = handleSelectBlocksArray;
    this.handleClearFocus = handleClearFocus;
    this.selectionBoxNode = selectionBoxNode;
    this.selectionBoxRef = selectionBoxRef;
    this.lineCreatorNode = lineCreatorNode;
    this.lineCreatorRef = lineCreatorRef;

    this.handleCreateLine = handleCreateLine;
    this.handleChangeLine = handleChangeLine;
    this.handleUpdateLine = handleUpdateLine;
    // this.schemaRender = schemaRender;

    this.blockCreatorNode = blockCreatorNode;
    this.blockCreatorRef = blockCreatorRef;
    this.blockCreatorStateToUpdate = {
      x: -1,
      y: -1,
      noSpaceForPage: false,
      show: true,
    };

    this.lastHoveredBlockID = null;
    // create grid
    this.grid = new FMGrid(this.node, {
      gridSize: gridCellSize,
      clusterSize: {
        width: 5,
        height: 5,
      },
      scale: scaleSettings,
    });

    this.backgroundGrid = false;
    this.createGridLayout();
    // this.updateGridLayout();
    this.bottomLayer = this.grid.createLayer(null, { name: 'bottomLayer' });
    this.backgroundLayer = this.grid.createLayer(null, { name: 'backgroundLayer' });
    // this.imageLayer = this.grid.createLayer(null, { name: 'imageLayer' });
    this.textLayer = this.grid.createLayer(null, { name: 'textLayer' });
    this.mainLayer = this.grid.createLayer(null, { name: 'mainLayer' });
    this.lineLayer = this.grid.createLayer(null, { name: 'lineLayer' });
    this.textLayer = this.grid.createLayer(null, { name: 'textLayer' });
    this.creatorLayer = this.grid.createLayer(null, { name: 'creatorLayer' });
    this.dragShadowLayer = this.grid.createLayer(null, { name: 'dragShadowLayer' });
    this.dragLayer = this.grid.createLayer(null, { name: 'dragLayer' });
    this.selectionBoxLayer = this.grid.createLayer(null, { name: 'selectionBoxLayer' });

    this.blockTypeToLayerMap = {
      [BLOCK_BACKGROUND]: this.backgroundLayer,
      [BLOCK_IMAGE]: this.backgroundLayer,
      [BLOCK_FIGURE]: this.mainLayer,
      [BLOCK_SITEMAP_PAGE]: this.mainLayer,
      [BLOCK_PERSONA]: this.mainLayer,
      [BLOCK_CJM]: this.mainLayer,
      [BLOCK_TEXT]: this.textLayer,
    };

    appendChildren(this.creatorLayer.node, this.blockCreatorNode);
    appendChildren(this.selectionBoxLayer.node, this.selectionBoxNode);
    appendChildren(this.dragShadowLayer.node, this.lineCreatorNode);

    // binding grid
    // this.grid.addCustomEventListener('click', onBlur);
    // this.grid.addCustomEventListener('moveViewBox', ({ s: newZoom }) => {
    //   if (typeof onZoomChange === 'function') {
    //     onZoomChange(newZoom);
    //   }
    // });

    // bBox combined item, so Alt to zoom2Fit will work
    this.gridItem = this.grid.createItem(
      {
        position: 'relative',
        coord: {
          x: 0,
          y: 0,
        },
        size: {
          width: 1,
          height: 1,
        },
      },
      this.bottomLayer,
    );

    this.startTime = Date.now();

    this.addBlockCreatorEventListener();
    this.addBlockHoverListener();
    this.addRegularGridClickListener();
    this.grid.addCustomEventListener('moveViewBox', ({ s: newZoom }) => {
      if (typeof onZoomChange === 'function') {
        onZoomChange(newZoom);
      }
      onMoveViewBox(this.grid.viewBoxPosition);
    });

    this.grid.addCustomEventListener('gridDragStart', this.handleMouseSelectionStart);
    // eslint-disable-next-line no-restricted-globals
    top.debug = this;

    this.pathFinder = new PathFinder({ scalingCoefficient: pathFindingScalingCoefficient });
  }

  resizeThrottler = () => {
    // ignore resize events as long as an actualResizeHandler execution is in the queue
    if (!this.resizeTimeout) {
      this.resizeTimeout = setTimeout(() => {
        this.resizeTimeout = null;
        this.updateGridLayout();
      }, 50);
    }
  };

  /* SHOW GRID */
  createGridLayout = () => {
    const patternID = `svgGridLayoutPattern${+new Date()}`;
    const patternWidth = gridCellSize.width * 2;
    const patternHeight = gridCellSize.height * 2;
    const patternNode = createSvg(
      'pattern',
      {
        id: patternID,
        viewBox: `0,0,${patternWidth},${patternHeight}`,
        width: '10%',
        height: '10%',
      },
      null,
      [
        createSvg('rect', {
          x: 0,
          y: 0,
          width: gridCellSize.width,
          height: gridCellSize.height,
          fill: '#58A8F7',
          opacity: 0.05,
        }),
        createSvg('rect', {
          x: gridCellSize.width,
          y: 0,
          width: gridCellSize.width,
          height: gridCellSize.height,
          fill: '#58A8F7',
          opacity: 0.15,
        }),
        createSvg('rect', {
          x: 0,
          y: gridCellSize.height,
          width: gridCellSize.width,
          height: gridCellSize.height,
          fill: '#58A8F7',
          opacity: 0.15,
        }),
        createSvg('rect', {
          x: gridCellSize.width,
          y: gridCellSize.height,
          width: gridCellSize.width,
          height: gridCellSize.height,
          fill: '#58A8F7',
          opacity: 0.05,
        }),
      ],
    );
    const gridLayoutRenderNode = createSvg('rect', {
      width: '100%',
      height: '100%',
      fill: 'none',
      name: 'background grid',
    });
    this.grid.defs.appendChild(patternNode);
    this.grid.svg.insertBefore(gridLayoutRenderNode, this.grid.background.nextSibling);

    this.gridLayout = {
      patternID,
      // show: app.userParams.get(this.settingAddress.concat('gridLayout'), false),
      patternNode,
      renderNode: gridLayoutRenderNode,
    };
    this.grid.addCustomEventListener(['moveViewBox'], this.updateGridLayout);
    window.addEventListener('resize', this.resizeThrottler, false);
  };

  updateGridLayout = () => {
    if (!this.backgroundGrid) {
      setAttributes(this.gridLayout.renderNode, { fill: 'none' });
      return;
    }
    const { viewBoxPosition } = this.grid;
    const svgSize = this.grid.svgBoundingBox;
    const scale = viewBoxPosition.s;
    const cellWidth = gridCellSize.width * 2 * scale;
    const cellHeight = gridCellSize.height * 2 * scale;
    const patternWidth = (cellWidth / svgSize.width) * 100;
    const patternHeight = (cellHeight / svgSize.height) * 100;
    const { x } = viewBoxPosition;
    const { y } = viewBoxPosition;
    setAttributes(this.gridLayout.patternNode, {
      width: `${patternWidth}%`,
      height: `${patternHeight}%`,
      patternTransform: `translate(${x},${y})`,
    });
    setAttributes(this.gridLayout.renderNode, {
      fill: `url(#${this.gridLayout.patternID})`,
    });
  };

  setBackgroundGrid(value) {
    this.backgroundGrid = value;
    this.updateGridLayout();
  }
  /* SHOW GRID */

  addBlockCreatorEventListener = () => {
    this.grid.addCustomEventListener(['gridMouseMove'], this.updateBlockCreator);
  };

  addRegularGridClickListener = () => {
    this.grid.addCustomEventListener(['click'], this.handleClearFocus);
  };

  addBlockHoverListener = () => {
    this.grid.addCustomEventListener(['gridMouseMove'], this.setBlockHover);
  };

  addEscapeProcessing = (callback) => {
    this.keyboardLayer = new KeyboardBinding({
      binds: [
        {
          keys: {
            keyCode: 27,
          },
          keydown: (keyCode, state, event) => typeof callback === 'function' && callback(event),
          // keyup: (keyCode, state, event) =>
          //   this.triggerCustomEvent('fitToView', {
          //     state: false,
          //     event,
          //   }),
        },
      ],
      blending: 'merge',
      layerName: 'userflow',
    });
  };

  removeEscapeProcessing = () => this.keyboardLayer.die();

  removeBlockCreatorEventListener = () => {
    this.grid.removeCustomEventListener(['gridMouseMove'], this.updateBlockCreator);
  };

  removeRegularGridClickListener = () => {
    this.grid.removeCustomEventListener(['click'], this.handleClearFocus);
  };

  removeBlockHoverListener = () => {
    this.grid.removeCustomEventListener(['gridMouseMove'], this.setBlockHover);
  };

  setBlockHover = () => {
    if (!this.isEditable) {
      return;
    }
    const cursorCoord = this.grid.cursorPosition;
    const blocksIDs = Object.keys(this.blocksMap);

    const hoverId = blocksIDs
      .sort((a, b) => {
        const typeDiff =
          blockSortingMap[this.blocksMap[a][TYPE]] - blockSortingMap[this.blocksMap[b][TYPE]];
        if (typeDiff !== 0 || ![BLOCK_IMAGE, BLOCK_BACKGROUND].includes(this.blocksMap[a][TYPE])) {
          return typeDiff;
        }
        const aArea = this.blocksMap[a][BLOCK_WIDTH] * this.blocksMap[a][BLOCK_HEIGHT];
        const bArea = this.blocksMap[b][BLOCK_WIDTH] * this.blocksMap[b][BLOCK_HEIGHT];
        return typeDiff !== 0 ? typeDiff : aArea - bArea;
      })
      .find((id) => isPointInsideBBox(this.blocksMap[id].bBox, cursorCoord));

    if (hoverId !== this.lastHoveredBlockID) {
      // processing entering block
      if (hoverId) {
        const { node, apiRef } = this.blocksMap[hoverId];

        if (!this.isCommentsModeEnabled) {
          this.lineCreatorRef?.current?.setLocalState({ blockID: hoverId, show: true });
        }

        apiRef.current.setHoverOn(true);
        // prepare block drag'n'drop callbacks
        this.grid.unDrag(node);
        this.grid.onDrag(
          node,
          this.handleDragStart(hoverId),
          this.handleDragMove,
          this.handleDragEnd,
        );
      }

      // processing leaving block
      if (this.lastHoveredBlockID && this.blocksMap[this.lastHoveredBlockID]) {
        const { apiRef } = this.blocksMap[this.lastHoveredBlockID];
        // eslint-disable-next-line no-unused-expressions
        apiRef && apiRef.current.setHoverOn(false);
      }

      if (this.lastHoveredBlockID && this.blocksMap[this.lastHoveredBlockID] && !hoverId) {
        if (this.isCreatingLine) {
          const { blockID } = this.creatingLineData;
          if (blockID !== this.lastHoveredBlockID) {
            this.lineCreatorRef?.current?.setLocalState({ blockID: null, show: false });
            this.lineCreatorRef.current.setForceHoverDot(null);
          }
        } else {
          this.lineCreatorRef?.current?.setLocalState({ blockID: null, show: false });
        }

        const { node } = this.blocksMap[this.lastHoveredBlockID];
        // remove block drag'n'drop callbacks
        // eslint-disable-next-line no-unused-expressions
        node && this.grid.unDrag(node);
      }
      this.lastHoveredBlockID = hoverId;
    }
  };

  disableAllBlocksHover = () => {
    this.lineCreatorRef.current.setForceDisable(true);
  };

  enableAllBlocksHover = () => {
    this.lineCreatorRef.current.setForceDisable(false);
    this.lastHoveredBlockID = null;
  };

  //
  updateBlockCreator = () => {
    // this.debugMessageNode.textContent =
    // `${Math.round(this.grid.cursorPosition.x)} * ${Math.round(
    //   this.grid.cursorPosition.y,
    // )}`;
    if (
      this.isCommentsModeEnabled ||
      !this.isEditable ||
      this.isDragging ||
      this.isCreatingLine ||
      this.isDraggingLine ||
      this.focusedBlocksIDs.size > 0
    ) {
      return;
    }
    const cursorCoord = this.grid.cursorPosition;

    const oldCoord = this.oldCoord ? this.oldCoord : cursorCoord;
    const oldTime = this.startTime;
    this.startTime = Date.now();
    this.oldCoord = cursorCoord;
    const delay = this.startTime - oldTime;

    const vectorLength = distanceBetweenPoints(
      oldCoord.x,
      oldCoord.y,
      cursorCoord.x,
      cursorCoord.y,
    );

    const speed = vectorLength / delay;

    const cursorPosition = {
      x: Math.floor((cursorCoord.x + gridCellSize.width / 2) / gridCellSize.width),
      y: Math.floor((cursorCoord.y + gridCellSize.height / 2) / gridCellSize.height),
    };
    const blockCreatorPosition = {
      x: cursorPosition.x - blockCreatorSizeInCells.width / 2,
      y: cursorPosition.y - blockCreatorSizeInCells.height / 2,
    };
    const blockCreatorCoord = this.grid.scaleDimensions(blockCreatorPosition);
    const blockCreatorSize = this.grid.scaleDimensions(blockCreatorSizeInCells);

    const blockCreatorBBox = getBBox(
      blockCreatorCoord.x,
      blockCreatorCoord.y,
      blockCreatorSize.width,
      blockCreatorSize.height,
    );
    const existedBBoxes = Object.values(mapValues(this.blocksMap, 'bBox'));
    const overlap = isBBoxIntersectBBoxes(blockCreatorBBox, existedBBoxes);

    let show = !overlap;
    if ((speed > 0.5 && !overlap) || this.isHoverLine) {
      show = false;
      setTimeout(50, this.updateBlockCreator);
    }

    const blockCreatorStateToUpdate = {
      x: blockCreatorCoord.x,
      y: blockCreatorCoord.y,
      noSpaceForPage: false,
      show,
    };

    const { oldBlockCreatorStateToUpdate } = this;

    this.oldBlockCreatorStateToUpdate = blockCreatorStateToUpdate;
    if (!isEqual(oldBlockCreatorStateToUpdate, blockCreatorStateToUpdate)) {
      this.blockCreatorRef?.current?.setLocalState(blockCreatorStateToUpdate);
    }
  };

  createDragShadowNode = ({ x, y, width, height }) => {
    return createElement(
      'rect',
      {
        rx: 3,
        ry: 3,
        x,
        y,
        width,
        height,
      },
      {
        pointerEvents: 'none',
        fill: '#e1eaf3',
        stroke: gray,
        strokeWidth: '1px',
        strokeDasharray: '2px, 2px,',
        transition: transitionLong,
        opacity: 0.7,
      },
    );
  };

  getGridBoundPosition = (
    { x = 0, y = 0, width = 0, height = 0 },
    cellSize = gridCellSize,
    roundFunction = Math.round,
  ) => {
    const positionInCells = {
      x: roundFunction(x / cellSize.width),
      y: roundFunction(y / cellSize.height),
      width: roundFunction(width / cellSize.width),
      height: roundFunction(height / cellSize.height),
    };
    return {
      x: positionInCells.x * cellSize.width,
      y: positionInCells.y * cellSize.height,
      width: positionInCells.width * cellSize.width,
      height: positionInCells.height * cellSize.height,
    };
  };

  getDragOverlapControlBlocksBBoxes() {
    const { blocksIDToDrag } = this.dragData;
    return Object.values(this.blocksMap)
      .filter(
        (block) =>
          !overlapNonAffectedTypes.includes(block.blockType) &&
          !blocksIDToDrag.includes(block[USERFLOW_BLOCK_ID]),
      )
      .map((block) => ({ [USERFLOW_BLOCK_ID]: block[USERFLOW_BLOCK_ID], ...block.bBox }));
  }

  getResizeOverlapControlBlocksBBoxes(blockCID) {
    if (overlapNonAffectedTypes.includes(this.blocksMap[blockCID].blockType)) {
      return [];
    }
    return Object.values(this.blocksMap)
      .filter(
        (block) =>
          !overlapNonAffectedTypes.includes(block.blockType) &&
          block[USERFLOW_BLOCK_ID] !== blockCID,
      )
      .map((block) => ({ [USERFLOW_BLOCK_ID]: block[USERFLOW_BLOCK_ID], ...block.bBox }));
  }

  processOverlappedBlocks(currentlyOverlappedBlocks, newOverlappedBlocks) {
    const blocksToRemoveOverlap = [...currentlyOverlappedBlocks].filter(
      (id) => !newOverlappedBlocks.has(id),
    );
    const blocksToSetOverlap = [...newOverlappedBlocks].filter(
      (id) => !currentlyOverlappedBlocks.has(id),
    );
    blocksToRemoveOverlap.forEach((blockID) =>
      this.blocksMap[blockID].apiRef.current.setOverlap(false),
    );
    blocksToSetOverlap.forEach((blockID) =>
      this.blocksMap[blockID].apiRef.current.setOverlap(true),
    );
  }

  /* mouse selection */

  handleMouseSelectionStart = (event) => {
    if (event.event.shiftKey) {
      const cursorCoord = this.grid.cursorPosition;

      this.handleClearFocus();
      const blocksIDs = Object.keys(this.blocksMap);

      const existedBBoxes = blocksIDs.map((id) => {
        const bBox = this.blocksMap[id].innerBBox;
        // const bBox = this.blocksMap[id].apiRef.current.getInnerBBox();
        return { id, ...bBox };
      });
      this.removeBlockCreatorEventListener();
      this.removeBlockHoverListener();
      this.removeRegularGridClickListener();

      this.grid.addCustomEventListener('gridDragMove', this.handleMouseSelectionMove);
      this.grid.addCustomEventListener('gridDragEnd', this.handleMouseSelectionEnd);
      const selectionShadowNode = createElement(
        'rect',
        {
          x: cursorCoord.x,
          y: cursorCoord.y,
          width: 0,
          height: 0,
        },
        {
          pointerEvents: 'none',
          fill: '#58a8f7',
          transition: 'opacity 0.15s ease-out 0s',
          opacity: 0.1,
        },
      );
      appendChildren(this.bottomLayer.node, selectionShadowNode);
      this.dragData = {
        startingPosition: cursorCoord,
        lastLegalPosition: cursorCoord,
        selectionShadowNode,
        existedBBoxes,
        previousIntersections: [],
      };

      return false;
    }
    return true;
  };

  handleMouseSelectionMove = () => {
    const cursorCoord = this.grid.cursorPosition;
    const { selectionShadowNode, startingPosition } = this.dragData;
    const { left, top, width, height } = createBBoxByCorners(startingPosition, cursorCoord);

    setAttributes(selectionShadowNode, { x: left, y: top, width, height });
    this.handleMouseSelectionMoveHeavyActions();
  };

  handleMouseSelectionMoveHeavyActions = throttle(() => {
    const cursorCoord = this.grid.cursorPosition;
    const { startingPosition, existedBBoxes, previousIntersections } = this.dragData;
    const { left, top, bottom, right } = createBBoxByCorners(startingPosition, cursorCoord);
    const intersections = findBBoxIntersectBBoxes({ left, top, bottom, right }, existedBBoxes);

    if (intersections.length > 0) {
      const intersectionsIDs = intersections.map((block) => block.id);
      if (!isEqual(previousIntersections, intersectionsIDs)) {
        this.handleSelectBlocksArray(intersectionsIDs);
        this.dragData.previousIntersections = intersectionsIDs;
      }
    }
  }, 60);

  handleMouseSelectionEnd = () => {
    this.handleMouseSelectionMoveHeavyActions.cancel();
    const { selectionShadowNode } = this.dragData;
    selectionShadowNode.remove();
    this.grid.removeCustomEventListener('gridDragMove', this.handleMouseSelectionMove);
    this.grid.removeCustomEventListener('gridDragEnd', this.handleMouseSelectionEnd);
    this.addBlockCreatorEventListener();
    this.addBlockHoverListener();
    this.addRegularGridClickListener();
    this.dragData = {};
  };

  /* mouse selection */
  /* MOVE LINE CONNECTOR */
  handleMoveConnectorInit = (lineID, connectorProps) => {
    const { ref } = connectorProps;

    this.grid.unDrag(ref.current);
    this.grid.onDrag(
      ref.current,
      this.handleMoveConnectorStart(lineID, connectorProps),
      this.handleMoveConnectorMove,
      this.handleMoveConnectorEnd,
    );
  };

  handleMoveConnectorStart = (lineID, connectorProps) => () => {
    if (!this.isEditable) {
      return;
    }
    const { ref, connector, edge } = connectorProps;

    this.disableAllBlocksHover();
    this.isCreatingLine = true;

    const { apiRef } = this.linesMap[lineID];
    const movingConnectorNode = ref.current.cloneNode(true);
    apiRef.current.setDraggingConnectorData({ dragging: true, connector });
    movingConnectorNode.setAttribute('pointer-events', 'none');
    // movingConnectorNode.setAttribute('cursor', 'grabbing');
    this.grid.setCursor('grabbing');
    movingConnectorNode.firstChild.setAttribute('r', movingConnectorCircleRadius);
    movingConnectorNode.firstChild.style.opacity = 1;
    appendChildren(this.dragLayer.node, movingConnectorNode);

    this.creatingLineData = {
      lineID,
      connectorProps,
      movingConnectorNode,
      blockID: null,
      lastEdge: edge,
    };
  };

  handleMoveConnectorMove = ({ cursor }) => {
    if (!this.isCreatingLine) {
      return;
    }

    const {
      connectorProps,
      lineID,
      movingConnectorNode,
      lastBlockID,
      lastEdge,
    } = this.creatingLineData;
    const { connector, oppositeID, edge: originalEdge } = connectorProps;
    const rotateAngle =
      -edgeProps[originalEdge].rotate + 180 + lastEdge ? edgeProps[lastEdge].rotate : 0;
    movingConnectorNode.setAttribute(
      'transform',
      `translate(${cursor.x - movingConnectorCircleRadius / 2}, ${
        cursor.y - movingConnectorCircleRadius / 2
      }) rotate(${rotateAngle} ${movingConnectorCircleRadius / 2} ${
        movingConnectorCircleRadius / 2
      })`,
    );

    if (this.lastHoveredBlockID) {
      const { edge } = this.getSectorByPoint(this.lastHoveredBlockID, cursor);
      if (lastBlockID !== this.lastHoveredBlockID || lastEdge !== edge) {
        if (this.lastHoveredBlockID === oppositeID) {
          return;
        }
        this.creatingLineData.lastEdge = edge;
        this.creatingLineData.lastBlockID = this.lastHoveredBlockID;
        let edgeKey;
        let acceptingBlockIDKey;
        if (connector === DEPARTURE) {
          edgeKey = DEPARTURE_EDGE;
          acceptingBlockIDKey = DEPARTURE_ID;
        } else {
          edgeKey = DESTINATION_EDGE;
          acceptingBlockIDKey = DESTINATION_ID;
        }
        const lineUpdateMap = {
          [lineID]: { [acceptingBlockIDKey]: this.lastHoveredBlockID, [edgeKey]: edge },
        };
        this.handleUpdateLine(lineUpdateMap);
        this.creatingLineData.lineUpdateMap = lineUpdateMap;
      }
    }
  };

  handleMoveConnectorEnd = () => {
    if (!this.isCreatingLine) {
      return;
    }
    this.grid.unsetCursor();

    this.isCreatingLine = false;
    // eslint-disable-next-line no-unused-vars
    const { lineID, movingConnectorNode, lineUpdateMap } = this.creatingLineData;
    // const { ref } = connectorProps;
    const { apiRef } = this.linesMap[lineID];
    apiRef.current.setDraggingConnectorData({ dragging: false, connector: null });
    movingConnectorNode.remove();

    this.enableAllBlocksHover();
    // eslint-disable-next-line no-unused-expressions
    lineUpdateMap && this.handleChangeLine(wrapChangeRequest(lineUpdateMap, true));
    // this.grid.unsetCursor();
  };

  /* DRAG LINE (add or change intermediate point) */
  handleDragLineInit = (line) => {
    const { node } = line;

    if (this.isCommentsModeEnabled) {
      return;
    }

    this.grid.unDrag(node);
    this.grid.onDrag(
      node,
      this.handleDragLineStart(line[LINE_ID]),
      this.handleDragLineMove,
      this.handleDragLineEnd,
    );
  };

  handleDragLineStart = (lineID) => () => {
    const { apiRef } = this.linesMap[lineID];
    const isLineDraggable = apiRef.current.getIsDraggable();
    if (!isLineDraggable || this.isDragging || this.isCreatingLine) {
      return;
    }
    this.isDraggingLine = true;
    this.draggingLineData = {
      lineID,
    };
    apiRef.current.setDraggingLine(true);
    this.grid.setCursor('grabbing');
    this.disableAllBlocksHover();
  };

  handleDragLineMove = ({ cursor }) => {
    if (!this.isDraggingLine) {
      return;
    }
    const { lineID } = this.draggingLineData;
    const { apiRef } = this.linesMap[lineID];
    const cursorCoord = this.grid.cursorPosition;
    apiRef.current.setCurrentRoutePoint(cursor);
    apiRef.current.setCursorPosition(cursorCoord);

    this.draggingLineData.lineUpdateMap = {
      [lineID]: { [INTERMEDIATE_POINTS]: [cursor] },
    };
    this.handleDragLineMoveHeavyActionsThrottled();
  };

  handleDragLineMoveHeavyActionsThrottled = throttle(() => {
    const { lineUpdateMap } = this.draggingLineData;
    this.handleUpdateLine(lineUpdateMap);
  }, 300);

  handleDragLineEnd = () => {
    if (!this.isDraggingLine) {
      return;
    }
    const { lineID } = this.draggingLineData;
    const { apiRef } = this.linesMap[lineID];
    apiRef.current.setDraggingLine(false);

    // this.grid.unsetCursor();

    this.enableAllBlocksHover();
    const { lineUpdateMap } = this.draggingLineData;
    const forcedRequest = wrapChangeRequest(lineUpdateMap, true);
    // eslint-disable-next-line no-unused-expressions
    lineUpdateMap && this.handleChangeLine(forcedRequest);
    this.isDraggingLine = false;
    this.draggingLineData = {};

    this.grid.unsetCursor();
  };

  /* MOVE LINE ICON */
  handleMoveLineIconInit = (lineID, iconRef) => {
    this.grid.unDrag(iconRef.current);
    this.grid.onDrag(
      iconRef.current,
      this.handleMoveLineIconStart(lineID, iconRef),
      this.handleMoveLineIconMove,
      this.handleMoveLineIconEnd,
    );
  };

  handleMoveLineIconStart = (lineID, iconRef) => () => {
    this.isDragging = true;
    const { apiRef } = this.linesMap[lineID];
    apiRef.current.setDraggingIcon(true);

    this.dragData = {
      lineID,
      iconRef,
    };
  };

  handleMoveLineIconMove = throttle(({ cursor }) => {
    const { iconRef, lineID } = this.dragData;
    const { apiRef } = this.linesMap[lineID];
    apiRef.current.setDraggingIconPosition(cursor);
    iconRef.current.setAttribute('transform', `translate(${cursor.x} ${cursor.y})`);
  }, 10);

  handleMoveLineIconEnd = ({ cursor }) => {
    this.isDragging = false;
    const { lineID } = this.dragData;
    const { apiRef, [PARAM]: param } = this.linesMap[lineID];
    apiRef.current.setDraggingIcon(false);
    const changeMap = {
      [lineID]: { [PARAM]: { ...param, [ICON_POSITION]: cursor } },
    };

    this.handleChangeLine(changeMap);
  };

  /* CREATE LINE */
  handleCreateLineInit = (blockID, connectorProps) => () => {
    if (this.isCommentsModeEnabled) {
      return;
    }
    const { ref } = connectorProps;
    this.grid.unDrag(ref.current);
    this.grid.onDrag(
      ref.current,
      this.handleCreateLineStart(blockID, connectorProps),
      this.handleCreateLineMove,
      this.handleCreateLineEnd,
    );
  };

  handleCreateLineStart = (blockID, connectorProps) => () => {
    this.isCreatingLine = true;
    const { x, y, key } = connectorProps;
    const {
      // [BLOCK_X]: blockX, [BLOCK_Y]: blockY,
      apiRef,
    } = this.blocksMap[blockID];
    apiRef.current.setForceHoverDot(key);
    this.lineCreatorRef.current.setDisabledBlock(blockID);
    const lineNode = createElement(
      'line',
      {
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        stroke: promoBlue,
        'stroke-width': '2px',
        'pointer-events': 'none',
      },
      {},
    );

    this.creatingLineData = {
      blockID,
      connectorProps,
      lineNode,
    };
    appendChildren(this.lineLayer.node, lineNode);
  };

  getSectorByPoint = (blockID, point) => {
    const block = this.blocksMap[blockID];
    const x = point.x - block[BLOCK_X];
    const y = point.y - block[BLOCK_Y];
    const { [BLOCK_WIDTH]: width, [BLOCK_HEIGHT]: height } = block;
    const blockArea = width * height;
    const edgeAreas = {
      [TOP]: (y * width) / 2,
      [BOTTOM]: ((height - y) * width) / 2,
      [LEFT]: (x * height) / 2,
      [RIGHT]: ((width - x) * height) / 2,
    };

    return Object.keys(edgeAreas).reduce(
      (acc, edge) => {
        return edgeAreas[edge] < acc.minArea ? { edge, minArea: edgeAreas[edge] } : acc;
      },
      { edge: null, minArea: blockArea },
    );
  };

  handleCreateLineMove = ({ cursor }) => {
    const { lineNode, blockID } = this.creatingLineData;

    lineNode.setAttribute('x2', cursor.x);
    lineNode.setAttribute('y2', cursor.y);

    if (this.lastHoveredBlockID && this.lastHoveredBlockID !== blockID) {
      const { edge } = this.getSectorByPoint(this.lastHoveredBlockID, cursor);
      this.lineCreatorRef.current.setForceHoverDot(edge);
    }
  };

  handleCreateLineEnd = ({ cursor }) => {
    this.isCreatingLine = false;
    const { blockID, connectorProps, lineNode } = this.creatingLineData;
    const { apiRef } = this.blocksMap[blockID];
    const { key: edgeFrom } = connectorProps;

    apiRef.current.setForceHoverDot(null);
    this.lineCreatorRef.current.setDisabledBlock(null);
    this.lineCreatorRef.current.setForceHoverDot(null);
    lineNode.remove();

    if (this.lastHoveredBlockID && this.lastHoveredBlockID !== blockID) {
      const { edge: edgeTo } = this.getSectorByPoint(this.lastHoveredBlockID, cursor);
      const block = this.blocksMap[this.lastHoveredBlockID];
      block.apiRef.current.setForceHoverDot(null);
      // todo: проверка на наличие такой же связи

      const newLine = {
        [DEPARTURE_ID]: blockID,
        [DESTINATION_ID]: this.lastHoveredBlockID,
        [DEPARTURE_EDGE]: edgeFrom,
        [DESTINATION_EDGE]: edgeTo,
        [DEPARTURE_CONNECTOR_TYPE]: null,
        [DESTINATION_CONNECTOR_TYPE]: null,
        [INTERMEDIATE_POINTS]: [],
        [COLOR]: promoBlue,
        [DASH_ARRAY]: null,
        [ICON]: '',
      };

      this.handleCreateLine(newLine);
    }
  };

  /* RESIZE BLOCK */
  handleResizeInit = ({ node, dragDirection }) => {
    this.grid.unDrag(node);
    this.grid.onDrag(
      node,
      this.handleResizeStart(dragDirection),
      throttle(this.handleResizeMove, 20),
      this.handleResizeEnd,
    );
  };

  handleResizeStart = (dragDirection) => () => {
    // this.removeBlockCreatorEventListener();
    this.grid.disableContent(true, dragDirectionToCursorMap[dragDirection]);
    this.grid.screenEdgeMove(true);
    this.isDragging = true;
    this.disableAllBlocksHover();
    const blocksIDToDrag = [...this.focusedBlocksIDs];

    const blockTypesToDrag = new Set(blocksIDToDrag.map((id) => this.blocksMap[id].blockType));
    const isAllBlocksOffGrid = [...blockTypesToDrag].every((type) => offGridTypes.includes(type));

    const dragShadowNodes = [];
    blocksIDToDrag.forEach((id) => {
      const block = this.blocksMap[id];
      const { [BLOCK_WIDTH]: width, [BLOCK_HEIGHT]: height, [BLOCK_X]: x, [BLOCK_Y]: y } = block;
      appendChildren(this.dragLayer.node, this.blocksMap[id].node);

      let dragShadowNodeProps = { x, y, width, height };

      if (this.blocksMap[id].blockType === BLOCK_TEXT) {
        const textBBox = this.blocksMap[id].apiRef.current.getInnerBBoxByCurrentState();
        dragShadowNodeProps = getBBoxSizeAndCoord(textBBox);
      }

      const dragShadowNode = this.createDragShadowNode(dragShadowNodeProps);
      dragShadowNodes.push(dragShadowNode);
      appendChildren(this.dragShadowLayer.node, dragShadowNode);
      this.blocksMap[id].apiRef.current.setResizing(true);
    });

    this.dragData = {
      blocksIDToDrag,
      currentlyOverlappedBlocks: new Set(),
      dragDirection,
      deltaLimits: {},
      lastValidBBoxes: blocksIDToDrag.reduce(
        (acc, id) => ({ ...acc, [id]: this.blocksMap[id].bBox }),
        {},
      ),
      initialBBoxes: blocksIDToDrag.reduce(
        (acc, id) => ({ ...acc, [id]: this.blocksMap[id].bBox }),
        {},
      ),
      dragGridCellSize: isAllBlocksOffGrid ? notBoundCellSize : gridCellSize,
      dragShadowNodes,
    };
  };

  handleResizeMove = ({ delta }) => {
    const {
      blocksIDToDrag,
      dragDirection,
      initialBBoxes,
      dragGridCellSize,
      lastValidBBoxes,
      currentlyOverlappedBlocks,
      dragShadowNodes,
    } = this.dragData;

    if (!Array.isArray(blocksIDToDrag) || blocksIDToDrag.length === 0) {
      return;
    }

    const newOverlappedBlocks = new Set();

    const deltaBBox = { left: delta.x, top: delta.y, right: delta.x, bottom: delta.y };

    const affectedEdges = dragDirectionToEdgesMap[dragDirection];

    blocksIDToDrag.forEach((blockCID, index) => {
      const requestedBBox = { ...initialBBoxes[blockCID] };
      affectedEdges.forEach((edge) => {
        requestedBBox[edge] += deltaBBox[edge];
        const { blockType } = this.blocksMap[blockCID];
        const blockTypeMinSizeLimits = minimumBlockSizeMap[blockType];
        const blockTypeMaxSizeLimits = maximumBlockSizeMap[blockType];
        const newSize =
          dragDirectionToSignMap[edge] * (requestedBBox[edge] - requestedBBox[reverseEdge[edge]]);
        const sizeMinLimit = blockTypeMinSizeLimits[edgeToAxis[edge]];
        const sizeMaxLimit = blockTypeMaxSizeLimits[edgeToAxis[edge]];
        if (newSize < sizeMinLimit || newSize > sizeMaxLimit) {
          requestedBBox[edge] = lastValidBBoxes[blockCID][edge];
        }
      });

      const bBoxByXYChange = requestedBBox;
      const bBoxByXChange = replaceXBoundingBoxValues(requestedBBox, lastValidBBoxes[blockCID]);
      const bBoxByYChange = replaceYBoundingBoxValues(requestedBBox, lastValidBBoxes[blockCID]);

      const overlapControlBlocksBBoxes = this.getResizeOverlapControlBlocksBBoxes(blockCID);

      const intersectionsByXYBBox = findBBoxIntersectBBoxes(
        bBoxByXYChange,
        overlapControlBlocksBBoxes,
      );
      const intersectionsByXBBox = findBBoxIntersectBBoxes(
        bBoxByXChange,
        overlapControlBlocksBBoxes,
      );
      const intersectionsByYBBox = findBBoxIntersectBBoxes(
        bBoxByYChange,
        overlapControlBlocksBBoxes,
      );

      const canChangeByXY = intersectionsByXYBBox.length === 0;
      const canChangeByX = intersectionsByXBBox.length === 0;
      const canChangeByY = intersectionsByYBBox.length === 0;

      intersectionsByXYBBox.forEach((elem) => newOverlappedBlocks.add(elem[USERFLOW_BLOCK_ID]));

      let newValidBBox = null;
      if (canChangeByXY) {
        newValidBBox = bBoxByXYChange;
      } else if (canChangeByX) {
        newValidBBox = bBoxByXChange;
      } else if (canChangeByY) {
        newValidBBox = bBoxByYChange;
      }
      if (newValidBBox) {
        this.dragData.lastValidBBoxes[blockCID] = newValidBBox;

        //  render blocks
        let tempBBox;
        if (this.blocksMap[blockCID].blockType !== BLOCK_TEXT) {
          tempBBox = newValidBBox;
        } else {
          tempBBox = {
            left: Math.round(newValidBBox.left / dragGridCellSize.width) * dragGridCellSize.width,
            right: Math.round(newValidBBox.right / dragGridCellSize.width) * dragGridCellSize.width,
            top: Math.round(newValidBBox.top / dragGridCellSize.height) * dragGridCellSize.height,
            bottom:
              Math.round(newValidBBox.bottom / dragGridCellSize.height) * dragGridCellSize.height,
          };
        }
        this.blocksMap[blockCID].apiRef?.current?.setLocalState({
          ...getBBoxSizeAndCoord(tempBBox),
          show: true,
        });
      }

      // rerender resize shadows
      const lastValidBBox = this.dragData.lastValidBBoxes[blockCID];
      let fittedRequestBBox = {
        left: Math.round(lastValidBBox.left / dragGridCellSize.width) * dragGridCellSize.width,
        right: Math.round(lastValidBBox.right / dragGridCellSize.width) * dragGridCellSize.width,
        top: Math.round(lastValidBBox.top / dragGridCellSize.height) * dragGridCellSize.height,
        bottom:
          Math.round(lastValidBBox.bottom / dragGridCellSize.height) * dragGridCellSize.height,
      };

      if (this.blocksMap[blockCID].blockType === BLOCK_TEXT) {
        const textBBox = this.blocksMap[blockCID].apiRef.current.getInnerBBoxByCurrentState();
        fittedRequestBBox = {
          left: Math.round(textBBox.left / dragGridCellSize.width) * dragGridCellSize.width,
          right: Math.round(textBBox.right / dragGridCellSize.width) * dragGridCellSize.width,
          top: Math.round(textBBox.top / dragGridCellSize.height) * dragGridCellSize.height,
          bottom: Math.round(textBBox.bottom / dragGridCellSize.height) * dragGridCellSize.height,
        };
      }
      const {
        x: shadowX,
        y: shadowY,
        width: shadowWidth,
        height: shadowHeight,
      } = getBBoxSizeAndCoord(fittedRequestBBox);

      dragShadowNodes[index].setAttribute('x', shadowX);
      dragShadowNodes[index].setAttribute('y', shadowY);
      dragShadowNodes[index].setAttribute('width', shadowWidth);
      dragShadowNodes[index].setAttribute('height', shadowHeight);
    });

    // refresh overlaps
    this.processOverlappedBlocks(currentlyOverlappedBlocks, newOverlappedBlocks);
    this.dragData.currentlyOverlappedBlocks = newOverlappedBlocks;

    // refresh SelectionBox
    const existedBBoxesPixels = blocksIDToDrag.map((blockID) =>
      this.blocksMap[blockID].apiRef.current.getInnerBBoxByCurrentState(),
    );
    // const existedBBoxesPixels = blocksIDToDrag.map((blockID) =>
    //   this.blocksMap[blockID].apiRef.current.getInnerBBox(),
    // );
    const selectionBBoxPixelsPure = concatBBox(existedBBoxesPixels);
    const { bottom, left, right, top } = selectionBBoxPixelsPure;
    const selectionX = left;
    const selectionY = top;
    const selectionWidth = right - left;
    const selectionHeight = bottom - top;
    this.selectionBoxRef?.current?.setLocalState({
      x: selectionX,
      y: selectionY,
      width: selectionWidth,
      height: selectionHeight,
      show: true,
    });
  };

  handleResizeEnd = () => {
    const {
      blocksIDToDrag,
      currentlyOverlappedBlocks,
      dragShadowNodes,
      dragGridCellSize,
    } = this.dragData;

    const changeMap = blocksIDToDrag.reduce((acc, blockID) => {
      const lastValidBBox = this.dragData.lastValidBBoxes[blockID];
      const fittedRequestBBox = {
        left: Math.round(lastValidBBox.left / dragGridCellSize.width) * dragGridCellSize.width,
        right: Math.round(lastValidBBox.right / dragGridCellSize.width) * dragGridCellSize.width,
        top: Math.round(lastValidBBox.top / dragGridCellSize.height) * dragGridCellSize.height,
        bottom:
          Math.round(lastValidBBox.bottom / dragGridCellSize.height) * dragGridCellSize.height,
      };

      const { x, y, width, height } = getBBoxSizeAndCoord(fittedRequestBBox);
      let newHeight = height;
      let newY = y;
      const block = this.blocksMap[blockID];
      if (block[TYPE] === TEXT_BLOCK) {
        const updatedTextState = block.apiRef.current.getUpdatedTextState();
        newHeight = updatedTextState.height;
        newY = updatedTextState.y;
      }
      let blockChangeMap;
      if (block[TYPE] === BLOCK_IMAGE) {
        const {
          [PARAM]: { [IMAGE_WIDTH]: imageWidth, [IMAGE_HEIGHT]: imageHeight },
        } = block;
        const scaledSize = getScaledImageDimensions(
          imageWidth,
          imageHeight,
          width,
          newHeight,
          true,
        );

        blockChangeMap = {
          [BLOCK_X]: x + scaledSize.targetLeft,
          [BLOCK_Y]: newY + scaledSize.targetTop,
          [BLOCK_WIDTH]: scaledSize.width,
          [BLOCK_HEIGHT]: scaledSize.height,
        };
        // console.log({ blockChangeMap, scaledSize });
      } else {
        blockChangeMap = {
          [BLOCK_X]: x,
          [BLOCK_Y]: newY,
          [BLOCK_WIDTH]: width,
          [BLOCK_HEIGHT]: newHeight,
        };
      }
      return {
        ...acc,
        [blockID]: blockChangeMap,
      };
    }, {});

    this.handleChangeBlocks(changeMap);

    blocksIDToDrag.forEach((id) => {
      const block = this.blocksMap[id];
      const { blockType } = block;
      const layerToPutBlock = this.blockTypeToLayerMap[blockType];
      appendChildren(layerToPutBlock.node, this.blocksMap[id].node);
      this.blocksMap[id].apiRef.current.setResizing(false);
    });

    currentlyOverlappedBlocks.forEach((blockID) =>
      this.blocksMap[blockID].apiRef.current.setOverlap(false),
    );

    dragShadowNodes.forEach((node) => node.remove());

    this.enableAllBlocksHover();
    this.grid.disableContent(false);
    this.grid.screenEdgeMove(false);
    this.isDragging = false;
    this.dragData = {};
    this.render();
  };

  // getAcceptingBackground = (blockApi) => {
  //   const backgrounds = this.backgroundsToAcceptItems
  //     .reduce((acc, background) => {
  //       const isContain = isBBoxContain(blockApi.current.getInnerBBox(), background.bBox);
  //       return isContain ? [...acc, background] : acc;
  //     }, [])
  //     .sort((a, b) => getBBoxArea(a.bBox) - getBBoxArea(b.bBox));
  //
  //   return backgrounds[0];
  // };

  /* DRAG BLOCK */
  handleDragStart = (blockCID) => () => {
    // this.removeBlockCreatorEventListener();

    if (this.isCreatingLine || this.isCommentsModeEnabled) {
      return;
    }
    this.disableAllBlocksHover();

    this.grid.disableContent(true);
    this.grid.screenEdgeMove(true);
    this.grid.setCursor('grabbing');
    this.isDragging = true;

    const blocksIDToDrag = this.focusedBlocksIDs.has(blockCID)
      ? [...this.focusedBlocksIDs]
      : [blockCID];

    const backgroundsIDToDrag = blocksIDToDrag.filter(
      (backID) => this.blocksMap[backID][TYPE] === BLOCK_BACKGROUND,
    );
    const notDraggedBlocksIDs = difference(Object.keys(this.blocksMap), blocksIDToDrag);
    const blocksGroupedToDraggedBackgrounds = notDraggedBlocksIDs.filter((id) => {
      // noinspection UnnecessaryLocalVariableJS
      const isBlockGrouped = backgroundsIDToDrag.some((backgroundID) => {
        return isBBoxContain(this.blocksMap[id].bBox, this.blocksMap[backgroundID].bBox);
      });
      return isBlockGrouped;
      // const isBlockGrouped = backgroundsIDToDrag.includes(this.blocksMap[id][PARAM][GROUP_TO]);
      // if (!isBlockGrouped) {
      //   return false;
      // }
      // const blockGroupedTo = this.blocksMap[id][PARAM][GROUP_TO];
      // return isBBoxContain(this.blocksMap[id].bBox, this.blocksMap[blockGroupedTo].bBox);
    });

    // this.backgroundsToAcceptItems = Object.values(this.blocksMap).filter(
    //   (block) =>
    //     !blocksIDToDrag.includes(block[USERFLOW_BLOCK_ID]) && block[TYPE] === BLOCK_BACKGROUND,
    // );

    this.dragData = {
      blocksIDToDrag: [...blocksIDToDrag, ...blocksGroupedToDraggedBackgrounds],
      blocksGroupedToDraggedBackgrounds,
      currentlyOverlappedBlocks: new Set(),
      savedSelection: blocksIDToDrag,
    };
    this.handleClearFocus();

    this.dragData.shadowOriginalPositionNodes = [];
    this.dragData.dragShadowNodes = [];

    this.dragData.blocksIDToDrag.forEach((id) => {
      const block = this.blocksMap[id];
      const { [BLOCK_WIDTH]: width, [BLOCK_HEIGHT]: height, [BLOCK_X]: x, [BLOCK_Y]: y } = block;

      appendChildren(this.dragLayer.node, this.blocksMap[id].node);
      const shadowOriginalPositionNode = this.blocksMap[id].node.cloneNode(true);
      shadowOriginalPositionNode.style.opacity = 0.3;
      this.dragData.shadowOriginalPositionNodes.push(shadowOriginalPositionNode);
      appendChildren(this.bottomLayer.node, shadowOriginalPositionNode);

      const dragShadowNode = this.createDragShadowNode({ x, y, width, height });
      this.dragData.dragShadowNodes.push(dragShadowNode);
      appendChildren(this.dragShadowLayer.node, dragShadowNode);
    });

    const blockTypesToDrag = new Set(blocksIDToDrag.map((id) => this.blocksMap[id].blockType));
    const isAllBlocksOffGrid = [...blockTypesToDrag].every((type) => offGridTypes.includes(type));
    this.dragData.dragGridCellSize = isAllBlocksOffGrid ? notBoundCellSize : gridCellSize;
  };

  handleDragMove = ({ delta }) => {
    if (!this.isDragging) {
      return;
    }
    const { blocksIDToDrag } = this.dragData;
    this.dragData.delta = delta;

    blocksIDToDrag.forEach((blockCID) => {
      const block = this.blocksMap[blockCID];
      const {
        apiRef,
        [BLOCK_WIDTH]: width,
        [BLOCK_HEIGHT]: height,
        [BLOCK_X]: oldX,
        [BLOCK_Y]: oldY,
      } = block;

      const x = oldX + delta.x;
      const y = oldY + delta.y;

      apiRef?.current?.setLocalState({
        x,
        y,
        width,
        height,
        show: true,
        dragging: true,
      });
    });
    this.handleHeavyDragMoveActionsThrottled();
  };

  handleHeavyDragMoveActionsThrottled = throttle(() => {
    const {
      blocksIDToDrag,
      currentlyOverlappedBlocks,
      dragShadowNodes,
      delta,
      dragGridCellSize,
    } = this.dragData;

    const newOverlappedBlocks = new Set();
    const overlapControlBlocksBBoxes = this.getDragOverlapControlBlocksBBoxes();

    const backgroundsToLightUp = new Set();

    blocksIDToDrag.forEach((blockCID, index) => {
      const block = this.blocksMap[blockCID];
      const {
        [BLOCK_WIDTH]: width,
        [BLOCK_HEIGHT]: height,
        [BLOCK_X]: oldX,
        [BLOCK_Y]: oldY,
        // bBox,
        // apiRef,
        blockType,
      } = block;

      const deltaPositionGridBound = this.getGridBoundPosition(
        { x: delta.x, y: delta.y },
        dragGridCellSize,
      );

      const x = oldX + deltaPositionGridBound.x;
      const y = oldY + deltaPositionGridBound.y;

      dragShadowNodes[index].setAttribute('x', x);
      dragShadowNodes[index].setAttribute('y', y);

      if (overlapNonAffectedTypes.includes(blockType)) {
        return;
      }
      findBBoxIntersectBBoxes(
        { left: x, top: y, right: x + width, bottom: y + height },
        overlapControlBlocksBBoxes,
      ).forEach((element) => newOverlappedBlocks.add(element[USERFLOW_BLOCK_ID]));
    });

    this.backgroundsToAcceptItems.forEach((background) => {
      const shouldLightUp = backgroundsToLightUp.has(background[USERFLOW_BLOCK_ID]);
      background.apiRef.current.setIsAccepting(shouldLightUp);
    });

    this.processOverlappedBlocks(currentlyOverlappedBlocks, newOverlappedBlocks);

    this.dragData.currentlyOverlappedBlocks = newOverlappedBlocks;
  }, 50);

  handleDragEnd = () => {
    if (!this.isDragging) {
      return;
    }

    this.handleHeavyDragMoveActionsThrottled.cancel();
    const {
      blocksIDToDrag,
      currentlyOverlappedBlocks,
      shadowOriginalPositionNodes,
      dragShadowNodes,
      delta,
      dragGridCellSize,
      savedSelection,
      // blocksGroupedToDraggedBackgrounds,
    } = this.dragData;
    if (currentlyOverlappedBlocks.size === 0) {
      const changeMap = blocksIDToDrag.reduce((acc, blockCID) => {
        const block = this.blocksMap[blockCID];
        const { [BLOCK_X]: x, [BLOCK_Y]: y } = block;
        const deltaPositionGridBound = this.getGridBoundPosition(
          { x: delta.x, y: delta.y },
          dragGridCellSize,
        );

        return {
          ...acc,
          [blockCID]: {
            [BLOCK_X]: x + deltaPositionGridBound.x,
            [BLOCK_Y]: y + deltaPositionGridBound.y,
            // [PARAM]: newParam,
          },
        };
      }, {});

      this.handleChangeBlocks(changeMap);
    }

    blocksIDToDrag.forEach((id) => {
      const block = this.blocksMap[id];
      const { blockType } = block;
      const layerToPutBlock = this.blockTypeToLayerMap[blockType];
      appendChildren(layerToPutBlock.node, this.blocksMap[id].node);
    });

    currentlyOverlappedBlocks.forEach((blockID) =>
      this.blocksMap[blockID].apiRef.current.setOverlap(false),
    );

    shadowOriginalPositionNodes.forEach((node) => node.remove());
    dragShadowNodes.forEach((node) => node.remove());

    this.grid.disableContent(false);
    this.grid.screenEdgeMove(false);
    this.isDragging = false;
    this.dragData = {};
    this.handleSelectBlocksArray(savedSelection);
    this.render();
    this.grid.unsetCursor();
    this.enableAllBlocksHover();
  };

  requestBlocksToMoveByArrow = ({ key }) => {
    const shiftMap = {
      ArrowLeft: { x: -gridCellSize.width, y: 0 },
      ArrowRight: { x: +gridCellSize.width, y: 0 },
      ArrowUp: { x: 0, y: -gridCellSize.height },
      ArrowDown: { x: 0, y: +gridCellSize.height },
    };

    const blocksIDToMove = [...this.focusedBlocksIDs];
    const blocksIDsToMoveNonAffected = blocksIDToMove.filter((id) =>
      overlapNonAffectedTypes.includes(this.blocksMap[id].blockType),
    );
    const blocksIDsToMoveAffected = blocksIDToMove.filter(
      (id) => !overlapNonAffectedTypes.includes(this.blocksMap[id].blockType),
    );

    const notMovedBlocksIDs = difference(Object.keys(this.blocksMap), blocksIDToMove);
    const bBoxesToControlOverlap = notMovedBlocksIDs
      // const bBoxesToControlOverlap = Object.keys(this.blocksMap)
      .filter((id) => !overlapNonAffectedTypes.includes(this.blocksMap[id].blockType))
      .map((id) => ({ ...this.blocksMap[id].bBox, id }));

    const overlappedBlocksIDs = new Set();

    const blocksIDsToMoveAffectedFreeToMove = [];
    const blocksIDsBlocked = [];
    blocksIDsToMoveAffected.forEach((id) => {
      const requestedBBox = applyBBoxShift(this.blocksMap[id].bBox, shiftMap[key]);
      const intersectedIDs = findBBoxIntersectBBoxes(requestedBBox, bBoxesToControlOverlap);
      if (intersectedIDs.length > 0) {
        intersectedIDs.forEach((element) => overlappedBlocksIDs.add(element.id));
        blocksIDsBlocked.push(id);
      } else {
        blocksIDsToMoveAffectedFreeToMove.push(id);
      }
    });

    [...overlappedBlocksIDs, ...blocksIDsBlocked].forEach((id) =>
      this.blocksMap[id].apiRef.current.setOverlap(true),
    );
    setTimeout(
      () =>
        [...overlappedBlocksIDs, ...blocksIDsBlocked].forEach((id) =>
          this.blocksMap[id].apiRef.current.setOverlap(false),
        ),
      1000,
    );

    const blocksIDsToMove = [...blocksIDsToMoveNonAffected, ...blocksIDsToMoveAffectedFreeToMove];
    return {
      blocksIDs: blocksIDsToMove,
      // bBoxShift: shiftMap[key],
      bBoxShift: overlappedBlocksIDs.size === 0 ? shiftMap[key] : { x: 0, y: 0 },
    };
  };

  /* paste selection */
  cancelPastingSelection = () => this.handlePasteSelectionEnd({ cancelPaste: true });

  handlePasteSelectionStart = () => {
    const { blocksMap } = this;

    if (this.isDragging || this.isCreatingLine || this.isDraggingLine) {
      return;
    }

    this.removeBlockCreatorEventListener();
    this.removeBlockHoverListener();
    this.removeRegularGridClickListener();

    this.grid.addCustomEventListener(['gridMouseMove'], this.handlePasteSelectionMove);
    this.grid.addCustomEventListener(['click'], this.handlePasteSelectionEnd);
    this.addEscapeProcessing(this.cancelPastingSelection);

    this.disableAllBlocksHover();
    this.grid.disableContent(true);
    this.grid.screenEdgeMove(true);
    this.grid.setCursor('grabbing');
    this.handleClearFocus();
    this.isDragging = true;

    const allBlockIDs = Object.keys(blocksMap);
    const temporaryBlockIDs = allBlockIDs.filter((id) => blocksMap[id][TEMPORARY_BLOCK]);
    const temporaryBlocksBBoxes = temporaryBlockIDs.map((blockID) => blocksMap[blockID].bBox);
    const temporaryCommonBBox = concatBBox(temporaryBlocksBBoxes);
    const commonBBoxCenter = getBBoxCenter(temporaryCommonBBox);
    const startingCursorPosition = this.grid.cursorPosition;
    const shiftX = startingCursorPosition.x - commonBBoxCenter.x;
    const shiftY = startingCursorPosition.y - commonBBoxCenter.y;

    this.dragData = {
      blocksIDToDrag: temporaryBlockIDs,
      currentlyOverlappedBlocks: new Set(),
      startingCursorPosition,
      shiftX,
      shiftY,
    };

    this.dragData.dragShadowNodes = [];

    this.dragData.blocksIDToDrag.forEach((id) => {
      const block = this.blocksMap[id];
      const { [BLOCK_WIDTH]: width, [BLOCK_HEIGHT]: height, [BLOCK_X]: x, [BLOCK_Y]: y } = block;

      appendChildren(this.dragLayer.node, this.blocksMap[id].node);
      const dragShadowNode = this.createDragShadowNode({ x, y, width, height });
      this.dragData.dragShadowNodes.push(dragShadowNode);
      appendChildren(this.dragShadowLayer.node, dragShadowNode);
    });

    const blockTypesToDrag = new Set(temporaryBlockIDs.map((id) => this.blocksMap[id].blockType));
    const isAllBlocksOffGrid = [...blockTypesToDrag].every((type) => offGridTypes.includes(type));
    this.dragData.dragGridCellSize = isAllBlocksOffGrid ? notBoundCellSize : gridCellSize;
    this.handlePasteSelectionMove();
  };

  handlePasteSelectionMove = () => {
    if (!this.isDragging) {
      return;
    }
    const { blocksIDToDrag, startingCursorPosition, shiftX, shiftY } = this.dragData;

    const cursorCoord = this.grid.cursorPosition;
    const delta = {
      x: -startingCursorPosition.x + cursorCoord.x + shiftX,
      y: -startingCursorPosition.y + cursorCoord.y + shiftY,
    };
    this.dragData.delta = delta;

    blocksIDToDrag.forEach((blockCID) => {
      const block = this.blocksMap[blockCID];
      const {
        apiRef,
        [BLOCK_WIDTH]: width,
        [BLOCK_HEIGHT]: height,
        [BLOCK_X]: oldX,
        [BLOCK_Y]: oldY,
      } = block;

      const x = oldX + delta.x;
      const y = oldY + delta.y;

      apiRef?.current?.setLocalState({
        x,
        y,
        width,
        height,
        show: true,
        dragging: true,
      });
    });
    this.handlePasteSelectionMoveHeavyActions();
  };

  handlePasteSelectionMoveHeavyActions = throttle(() => {
    const {
      blocksIDToDrag,
      currentlyOverlappedBlocks,
      dragShadowNodes,
      delta,
      dragGridCellSize,
    } = this.dragData;

    const newOverlappedBlocks = new Set();
    const overlapControlBlocksBBoxes = this.getDragOverlapControlBlocksBBoxes();

    const backgroundsToLightUp = new Set();

    blocksIDToDrag.forEach((blockCID, index) => {
      const block = this.blocksMap[blockCID];
      const {
        [BLOCK_WIDTH]: width,
        [BLOCK_HEIGHT]: height,
        [BLOCK_X]: oldX,
        [BLOCK_Y]: oldY,
        blockType,
      } = block;

      const deltaPositionGridBound = this.getGridBoundPosition(
        { x: delta.x, y: delta.y },
        dragGridCellSize,
      );

      const x = oldX + deltaPositionGridBound.x;
      const y = oldY + deltaPositionGridBound.y;

      dragShadowNodes[index].setAttribute('x', x);
      dragShadowNodes[index].setAttribute('y', y);

      if (overlapNonAffectedTypes.includes(blockType)) {
        return;
      }
      findBBoxIntersectBBoxes(
        { left: x, top: y, right: x + width, bottom: y + height },
        overlapControlBlocksBBoxes,
      ).forEach((element) => newOverlappedBlocks.add(element[USERFLOW_BLOCK_ID]));
    });

    this.backgroundsToAcceptItems.forEach((background) => {
      const shouldLightUp = backgroundsToLightUp.has(background[USERFLOW_BLOCK_ID]);
      background.apiRef.current.setIsAccepting(shouldLightUp);
    });

    this.processOverlappedBlocks(currentlyOverlappedBlocks, newOverlappedBlocks);

    this.dragData.currentlyOverlappedBlocks = newOverlappedBlocks;
  }, 50);

  handlePasteSelectionEnd = async ({ cancelPaste = false }) => {
    if (!this.isDragging) {
      return;
    }

    this.handlePasteSelectionMoveHeavyActions.cancel();

    this.grid.removeCustomEventListener(['gridMouseMove'], this.handlePasteSelectionMove);
    this.grid.removeCustomEventListener(['click'], this.handlePasteSelectionEnd);
    this.removeEscapeProcessing();
    const {
      blocksIDToDrag,
      currentlyOverlappedBlocks,
      dragShadowNodes,
      delta,
      dragGridCellSize,
    } = this.dragData;

    currentlyOverlappedBlocks.forEach((blockID) =>
      this.blocksMap[blockID].apiRef.current.setOverlap(false),
    );

    dragShadowNodes.forEach((node) => node.remove());

    this.addBlockCreatorEventListener();
    this.addBlockHoverListener();
    this.addRegularGridClickListener();
    this.grid.unsetCursor();
    this.enableAllBlocksHover();
    this.grid.disableContent(false);
    this.grid.screenEdgeMove(false);
    this.isDragging = false;
    this.isPasting = false;
    this.dragData = {};

    const temporaryLinesIDs = Object.keys(this.linesMap).filter(
      (lineID) => this.linesMap[lineID][TEMPORARY_LINE],
    );

    if (currentlyOverlappedBlocks.size === 0 && !cancelPaste) {
      const createBlocksMap = blocksIDToDrag.reduce((acc, blockID) => {
        const block = this.blocksMap[blockID];
        const { [BLOCK_X]: x, [BLOCK_Y]: y } = block;
        const deltaPositionGridBound = this.getGridBoundPosition(
          { x: delta.x, y: delta.y },
          dragGridCellSize,
        );

        return [
          ...acc,
          {
            ...block,
            [BLOCK_X]: x + deltaPositionGridBound.x,
            [BLOCK_Y]: y + deltaPositionGridBound.y,
            [TEMPORARY_BLOCK]: false,
          },
        ];
      }, []);
      const createLinesMap = temporaryLinesIDs.reduce((acc, lineID) => {
        const line = this.linesMap[lineID];

        return [
          ...acc,
          {
            ...line,
            [TEMPORARY_LINE]: false,
          },
        ];
      }, []);
      const imagesLinksToAttachMap = blocksIDToDrag.reduce((acc, blockID) => {
        const block = this.blocksMap[blockID];
        if (block[TEMPORARY_IMAGE_LINK]) {
          return { ...acc, [blockID]: block[TEMPORARY_IMAGE_LINK] };
        }
        return acc;
      }, {});
      blocksIDToDrag.forEach((id) => {
        const block = this.blocksMap[id];
        const { blockType } = block;
        const layerToPutBlock = this.blockTypeToLayerMap[blockType];
        appendChildren(layerToPutBlock.node, this.blocksMap[id].node);
      });

      const respond = unwrapResult(await this.handleCreateBlocks(createBlocksMap));
      if (temporaryLinesIDs.length > 0) {
        this.handleCreateLine(createLinesMap);
      }

      if (!respond.err && !isEmpty(imagesLinksToAttachMap)) {
        this.attachImagesToUserflowBlocksByLinks(imagesLinksToAttachMap);
      }
    } else {
      this.handleRemoveUserflowBlocks(blocksIDToDrag);
      this.handleRemoveLines(temporaryLinesIDs);
    }
  };

  zoomTo100() {
    this.grid.scaleGrid(1, true, 300);
  }

  zoomFitToVIew() {
    this.grid.fitToView(300);
  }

  changeZoom(multiplier) {
    this.grid.smoothScale(0.02 * multiplier, true, true);
  }

  setScale(scale) {
    this.grid.scaleGrid(scale, true, true);
  }

  updateBlock(id, block) {
    this.blocksMap[id] = {
      ...this.blocksMap[id],
      ...block,
    };
    const {
      [BLOCK_WIDTH]: gridWidth,
      [BLOCK_HEIGHT]: gridHeight,
      [BLOCK_X]: gridX,
      [BLOCK_Y]: gridY,
    } = block;
    this.blocksMap[id].bBox = getBBox(gridX, gridY, gridWidth, gridHeight);
  }

  updateLine(id, line) {
    this.linesMap[id] = {
      ...this.linesMap[id],
      ...line,
    };
  }

  addBlockToGrid(id, block) {
    const {
      [BLOCK_WIDTH]: gridWidth,
      [BLOCK_HEIGHT]: gridHeight,
      [BLOCK_X]: gridX,
      [BLOCK_Y]: gridY,
      // [USERFLOW_BLOCK_ID]: blockID,
      blockType,
      node,
    } = block;

    const layerToPutBlock = this.blockTypeToLayerMap[blockType];
    appendChildren(layerToPutBlock.node, node);

    this.blocksMap[id] = block;
    this.blocksMap[id].bBox = getBBox(gridX, gridY, gridWidth, gridHeight);

    // addEventListener(node, [
    //   {
    //     event: 'mouseenter',
    //     callback: () => {
    //       // if (
    //       //   this.isCreatingLine &&
    //       //   this.creatingLineData.blockID !== id &&
    //       //   this.creatingLineData.enteringBlockID !== id
    //       // ) {
    //       //   this.creatingLineData.enteringBlockID = blockID;
    //       //   return;
    //       // }
    //       // this.grid.unDrag(node);
    //       // this.grid.onDrag(
    //       //   node,
    //       //   this.handleDragStart(blockID),
    //       //   // throttle(this.handleDragMove, 50),
    //       //   this.handleDragMove,
    //       //   this.handleDragEnd,
    //       // );
    //     },
    //   },
    //   {
    //     event: 'mouseleave',
    //     callback: () => {
    //       // if (this.isCreatingLine && this.creatingLineData.blockID !== id) {
    //       //   block.apiRef.current.setForceHoverDot(null);
    //       //   this.creatingLineData.enteringBlockID = null;
    //       //   return;
    //       // }
    //       // this.grid.unDrag(node);
    //     },
    //   },
    // ]);
  }

  addLineToGrid(id, line) {
    const { node } = line;
    this.linesMap[id] = line;

    appendChildren(this.lineLayer.node, node);
    addEventListener(node, [
      {
        event: 'mouseenter',
        callback: () => {
          this.isHoverLine = true;
          line.apiRef.current.setHoverOn(true);
          this.handleDragLineInit(line);
        },
      },
      {
        event: 'mousemove',
        callback: () => {
          const cursorCoord = this.grid.cursorPosition;
          line.apiRef.current.setCursorPosition(cursorCoord);
        },
      },
      {
        event: 'mouseleave',
        callback: () => {
          line.apiRef.current.setHoverOn(false);
          this.isHoverLine = false;
          this.grid.unDrag(node);
        },
      },
    ]);

    // this.linesMap[id] = line;
  }

  removeBlockFromGrid(id) {
    delete this.blocksMap[id];

    // disappear effect
    // if (disappearEffect) {
    //   this.grid.moveItem(gridItem, gridItem.coord, 150);
    //   this.grid.setTransform(gridItem.node, { o: 0 });
    //   setTimeout(() => this.grid.removeItem(gridItem), 200);
    // } else {
    //   this.grid.removeItem(gridItem);
    // }
  }

  removeLineFromGrid(id) {
    delete this.linesMap[id];

    // disappear effect
    // if (disappearEffect) {
    //   this.grid.moveItem(gridItem, gridItem.coord, 150);
    //   this.grid.setTransform(gridItem.node, { o: 0 });
    //   setTimeout(() => this.grid.removeItem(gridItem), 200);
    // } else {
    //   this.grid.removeItem(gridItem);
    // }
  }

  prepareMaze() {
    const obstacles = Object.values(this.blocksMap)
      .filter((block) => !overlapNonAffectedTypes.includes(block.blockType))
      .map((block) => block.bBox);
    const allBBoxes = Object.values(this.blocksMap).map((block) => block.bBox);
    const areaBBox = concatBBox(allBBoxes);
    this.pathFinder.prepareMap(areaBBox, obstacles);
  }

  die() {
    window.removeEventListener('resize', this.resizeThrottler);
    this.grid.die();
    this.grid = null;
  }

  update(maps, settings) {
    const { blocksMap, linesMap } = maps;
    const { isEditable, isCommentsModeEnabled } = settings;

    this.isEditable = isEditable;
    this.isCommentsModeEnabled = isCommentsModeEnabled;
    const oldBlocksIDs = Object.keys(this.blocksMap);
    const newBlocksIDs = Object.keys(blocksMap);
    const toAddBlocksIDs = difference(newBlocksIDs, oldBlocksIDs);
    const toRemoveBlocksIDs = difference(oldBlocksIDs, newBlocksIDs);
    const toUpdateBlocksIDs = intersection(oldBlocksIDs, newBlocksIDs);
    toAddBlocksIDs.forEach((blockID) => this.addBlockToGrid(blockID, blocksMap[blockID]));
    toRemoveBlocksIDs.forEach((blockID) => this.removeBlockFromGrid(blockID));
    toUpdateBlocksIDs.forEach((pageID) => this.updateBlock(pageID, blocksMap[pageID]));

    const oldLinesIDs = Object.keys(this.linesMap);
    const newLinesIDs = Object.keys(linesMap);
    const toAddLinesIDs = difference(newLinesIDs, oldLinesIDs);
    const toRemoveLinesIDs = difference(oldLinesIDs, newLinesIDs);
    const toUpdateLinesIDs = intersection(oldLinesIDs, newLinesIDs);

    toAddLinesIDs.forEach((lineID) => this.addLineToGrid(lineID, linesMap[lineID]));
    toRemoveLinesIDs.forEach((lineID) => this.removeLineFromGrid(lineID));
    toUpdateLinesIDs.forEach((lineID) => this.updateLine(lineID, linesMap[lineID]));

    this.prepareMaze();

    // this.grid.updateGrid();
    this.render();
  }

  render() {
    const { blocksMap, linesMap } = this;
    const allBlockIDs = Object.keys(blocksMap);

    const blockIDs = allBlockIDs.filter((id) => !blocksMap[id][TEMPORARY_BLOCK]);
    const temporaryBlockIDs = allBlockIDs.filter((id) => blocksMap[id][TEMPORARY_BLOCK]);
    if (!(this.isPasting || this.isDragging)) {
      blockIDs.forEach((blockID) => {
        const block = blocksMap[blockID];
        const {
          apiRef,
          [BLOCK_WIDTH]: width,
          [BLOCK_HEIGHT]: height,
          [BLOCK_X]: x,
          [BLOCK_Y]: y,
        } = block;

        apiRef?.current?.setLocalState({ x, y, width, height, show: true });
      });
    }
    const blocksIDsToSortByArea = blockIDs
      .filter((blockID) => [BLOCK_IMAGE, BLOCK_BACKGROUND].includes(this.blocksMap[blockID][TYPE]))
      .map((blockID) => ({
        blockID,
        area: this.blocksMap[blockID][BLOCK_WIDTH] * this.blocksMap[blockID][BLOCK_HEIGHT],
        blockType: this.blocksMap[blockID][TYPE],
      }))
      .sort((a, b) => b.area - a.area);
    blocksIDsToSortByArea.forEach(({ blockID, blockType }) => {
      // console.log(this.backgroundLayer.node, this.blocksMap[blockID]);
      const layerToPutBlock = this.blockTypeToLayerMap[blockType];

      appendChildren(layerToPutBlock.node, this.blocksMap[blockID].node);
    });
    if (temporaryBlockIDs.length > 0 && !this.isPasting) {
      this.isPasting = true;
      this.handlePasteSelectionStart();
    }

    // recalculate combined item, so Alt to zoom2Fit will work
    const allBlocksBBoxes = blockIDs.map((blockID) => blocksMap[blockID].bBox);
    const commonBBox = concatBBox(allBlocksBBoxes);
    const unscaledBBox = this.grid.unscaleDimensions(commonBBox);
    const bBoxSizeAndCoord = getBBoxSizeAndCoord(unscaledBBox);
    const {
      x: xCombinedItem,
      y: yCombinedItem,
      width: widthCombinedItem,
      height: heightCombinedItem,
    } = bBoxSizeAndCoord;
    this.grid.updateItem(this.gridItem, {
      coord: {
        x: xCombinedItem,
        y: yCombinedItem,
      },
      size: {
        width: widthCombinedItem,
        height: heightCombinedItem,
      },
    });

    const linesIDs = Object.keys(linesMap).filter(
      (lineID) => !this.linesMap[lineID][TEMPORARY_LINE],
    );

    if (!this.isDragging) {
      linesIDs.forEach((lineID) => {
        const { apiRef: lineApi } = linesMap[lineID];
        lineApi?.current?.forceRender();
      });
    }
    this.updateBlockCreator();

    // update selectionBox
    if (this.focusedBlocksIDs.size > 0 && !(this.isPasting || this.isDragging)) {
      const existedBBoxesPixels = [...this.focusedBlocksIDs].map(
        (blockID) => blocksMap[blockID].innerBBox,
      );

      const selectionBBoxPixelsPure = concatBBox(existedBBoxesPixels);

      const { bottom, left, right, top } = selectionBBoxPixelsPure;
      const x = left;
      const y = top;

      const width = right - left;
      const height = bottom - top;
      this.selectionBoxRef?.current?.setLocalState({ x, y, width, height, show: true });
    }
  }
}
