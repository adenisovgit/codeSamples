import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { Formik, FormikValues } from 'formik';
import cn from 'classnames';

import { useHistory } from 'react-router-dom';
import domainStore from '@stores/domainStore';
import { DeliveryType } from '@stores/types';
import { callFetchApi } from '@src/services/asyncApiFetch';
import { IErrorsType, IOrderRequest, IPromoCode, SubmitStateType } from '@src/views/Checkout/types';
import ScrollToFormikError from '@components/ScrollToFormikError';
import CheckoutDeliveryForm from './CheckoutDeliveryForm';
import styles from './styles.scss';
import ProductList from './ProductList';
import CheckoutPayment from './CheckoutPayment';
import { createOrderSchema, errorEmailValidation, errorPhoneValidation } from './validation';
import cartStore from '../../stores/cartStore';
import PromoForm from './PromoForm/PromoForm';
import CustomerInfoForm from './CustomerInfoForm';
import { CreateOrderError, errorResponseParser, prepareErrors, prepareProducts } from './utils';

const Checkout: React.FC = () => {
  // todo: before release remove views/cart, cartOld route, DeliverySelector,
  //  react-phone-input-2 lib
  const [promoCodeData, setPromoCodeData] = useState<IPromoCode>({ percent: 0, promoCode: '' });
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('shipping');
  const [submitState, setSubmitState] = useState<SubmitStateType>('');
  const history = useHistory();

  const initialValues = {
    name: '',
    email: '',
    phone: '+44',
    comment: '',
    address: '',
    regionId: '',
    city: '',
    areaId: '',
    deliveryPrice: null,
  };

  const createOrder = async (requestData: IOrderRequest) => {
    setSubmitState('submitting');
    try {
      const createOrderResponse = await callFetchApi(
        { url: '/order' },
        { method: 'post', body: requestData },
      );

      if (!createOrderResponse.data?.success) {
        throw new CreateOrderError('Order creation failed', createOrderResponse?.error);
      }

      const orderId = createOrderResponse?.data?._id;
      const orderNumber = createOrderResponse?.data?.number;

      cartStore.emptyCart();
      history.push('/order', {
        launchPayment: true,
        orderId,
        orderNumber,
        customerInfo: requestData.customer,
      });
    } catch (errors) {
      const parsedErrors = errorResponseParser(
        errors.data as { result: { errors: IErrorsType[] } },
      );
      const preparedErrors = prepareErrors(parsedErrors);
      const parsedErrorsMessages = Object.values(preparedErrors).map((err) => err[0]);
      if (parsedErrorsMessages.includes('Invalid payment link')) {
        setSubmitState('paymentLinkError');
      } else if (
        preparedErrors.phone?.[0] === 'Field error: bad format.' &&
        preparedErrors.email?.[0] === 'Not a well-formed email address.'
      ) {
        setSubmitState('apiEmailAndPhoneError');
      } else if (preparedErrors.phone?.[0] === 'Field error: bad format.') {
        setSubmitState('apiPhoneNumberError');
      } else if (preparedErrors.email?.[0] === 'Not a well-formed email address.') {
        setSubmitState('apiEmailError');
      } else {
        setSubmitState('otherErrors');
      }
      // eslint-disable-next-line no-console
      console.error(errors);
    }
  };

  // noinspection JSIgnoredPromiseFromCall
  const handleSubmitForm = (values: FormikValues) => {
    const requestData = {
      customer: {
        name: values.name,
        email: values.email,
        phone: values.phone.replace(/[^0-9.]/g, ''),
      },
      store_id: domainStore.currentStoreId,
      products: prepareProducts(cartStore.products, values, deliveryType),
      comment: values.comment,
      promo: promoCodeData.promoCode,
      origin: 'landing',
    };

    // noinspection JSIgnoredPromiseFromCall
    createOrder(requestData);
  };

  const validationSchema = createOrderSchema({ deliveryType });

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={handleSubmitForm}
      validationSchema={validationSchema}
    >
      {({ values, handleSubmit, setErrors, errors }) => {
        // this is the component, so we could use hooks
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
          if (submitState === 'apiPhoneNumberError') {
            setErrors({ ...errors, phone: errorPhoneValidation });
          } else if (submitState === 'apiEmailError') {
            setErrors({ ...errors, email: errorEmailValidation });
          } else if (submitState === 'apiEmailAndPhoneError') {
            setErrors({
              ...errors,
              email: errorEmailValidation,
              phone: errorPhoneValidation,
            });
          }
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [errors, setErrors, submitState]);
        return (
          <div className={cn(styles.orderContainer, styles.smoothAppearance)}>
            <div className={styles.checkoutContent}>
              <ProductList />
              <CustomerInfoForm />
              <CheckoutDeliveryForm onChangeDeliveryType={setDeliveryType} />
              <PromoForm onSubmitPromoCode={setPromoCodeData} />
            </div>
            <CheckoutPayment
              deliveryPrice={values.deliveryPrice}
              promoCodeData={promoCodeData}
              onSubmit={handleSubmit}
              isPaymentLinkCreating={submitState === 'submitting'}
              paymentLinkCreateError={
                ['paymentLinkError', 'otherErrors'].includes(submitState) ? submitState : ''
              }
            />
            <ScrollToFormikError />
          </div>
        );
      }}
    </Formik>
  );
};

export default observer(Checkout);
