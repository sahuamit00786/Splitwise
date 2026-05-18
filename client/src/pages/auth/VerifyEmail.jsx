// /client/src/pages/auth/VerifyEmail.jsx
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../../api/axios';
import toast from 'react-hot-toast';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setIsVerifying(false);
      return;
    }

    const verifyEmail = async () => {
      try {
        await api.get('/auth/verify-email', { params: { token } });
        setIsSuccess(true);
        toast.success('Email verified successfully! You can now log in.');
      } catch (error) {
        toast.error(error.response?.data?.message || 'Verification failed. Token may be invalid or expired.');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center px-4 py-8">
      <div className="max-w-md mx-auto w-full text-center">
        {isVerifying ? (
          <>
            <div className="text-6xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Verifying your email...</h1>
            <p className="text-gray-600">Please wait a moment</p>
          </>
        ) : isSuccess ? (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Email Verified!</h1>
            <p className="text-gray-600 mb-6">Your email has been successfully verified.</p>
            <Link to="/login" className="btn-primary inline-block">
              Go to Login
            </Link>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Verification Failed</h1>
            <p className="text-gray-600 mb-6">
              The verification link is invalid or has expired. Please request a new one.
            </p>
            <Link to="/login" className="btn-primary inline-block">
              Back to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
