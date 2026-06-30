import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import apiClient from '../../api/apiClient';
import LoadingSpinner from '../common/LoadingSpinner';

// Replace with your actual Stripe publishable test key
const stripePromise = loadStripe('pk_test_TYooMQauvdEDq54NiTphI7jx');

function CheckoutForm({ streamKey, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    // Confirm payment (for test mode, we just use confirmPayment and then handle success directly)
    // Normally you'd pass a return_url and let Stripe redirect, but for SPA we try to handle it inline
    // or just trigger success if there's no immediate redirect.
    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required', // Avoid redirect if possible
    });

    if (submitError) {
      setError(submitError.message);
      setLoading(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // In a real app, webhook handles DB update, but it might take a second.
      // We can just call onSuccess to retry joining the room.
      onSuccess();
    } else {
      // If it requires additional action (like 3D secure) and redirect='always',
      // it would have redirected.
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md bg-dark-surface p-6 rounded-lg border border-dark-border mx-auto">
      <h2 className="text-xl font-bold text-text-primary mb-4 text-center">Unlock this Stream</h2>
      <div className="bg-white p-4 rounded mb-6">
        <PaymentElement />
      </div>
      {error && <div className="text-red-500 text-sm mb-4">{error}</div>}
      <button 
        type="submit" 
        disabled={!stripe || loading} 
        className="btn-primary w-full py-3"
      >
        {loading ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
}

export default function PaymentForm({ streamKey, onSuccess }) {
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Create PaymentIntent as soon as the page loads
    apiClient.post('/payments/create-intent', { streamKey })
      .then((res) => setClientSecret(res.data.clientSecret))
      .catch((err) => setError(err.response?.data?.error || 'Failed to initialize payment'));
  }, [streamKey]);

  if (error) {
    return <div className="text-center text-red-500 py-10">{error}</div>;
  }

  if (!clientSecret) {
    return (
      <div className="flex justify-center py-10">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
      <CheckoutForm streamKey={streamKey} onSuccess={onSuccess} />
    </Elements>
  );
}
