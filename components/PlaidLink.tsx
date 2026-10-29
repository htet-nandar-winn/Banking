import React, { useCallback, useEffect, useState } from 'react'
import { Button } from './ui/button'
import { PlaidLinkOnSuccess, PlaidLinkOptions, usePlaidLink } from 'react-plaid-link'
import { useRouter } from 'next/navigation';
import { createLinkToken, exchangePublicToken } from '@/lib/actions/user.actions';
import Image from 'next/image';

const PlaidLink = ({ user, variant }: PlaidLinkProps) => {
  const router = useRouter();

  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const getLinkToken = async () => {
      const data = await createLinkToken(user);

      if (!data?.linkToken) {
        setError(data?.error ?? 'Unable to create a Plaid link token.');
        return;
      }

      setToken(data.linkToken);
    }

    getLinkToken();
  }, [user]);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(async (public_token: string) => {
    const result = await exchangePublicToken({
      publicToken: public_token,
      user,
    })

    if (result?.publicTokenExchange !== 'complete') {
      setError(result?.error ?? 'Unable to link your bank account.');
      return;
    }

    router.push('/');
  }, [user])
  
  const config: PlaidLinkOptions = {
    token,
    onSuccess
  }

  const { open, ready } = usePlaidLink(config);

  const errorMessage = error ? (
    <p role="alert" className="text-sm text-red-600 max-w-[280px]">
      {error}
    </p>
  ) : null;

  return (
    <>
      {errorMessage}
      {variant === 'primary' ? (
        <Button
          onClick={() => open()}
          disabled={!ready}
          className="plaidlink-primary"
        >
          Connect bank
        </Button>
      ): variant === 'ghost' ? (
        <Button onClick={() => open()} variant="ghost" className="plaidlink-ghost">
          <Image 
            src="/icons/connect-bank.svg"
            alt="connect bank"
            width={24}
            height={24}
          />
          <p className='hiddenl text-[16px] font-semibold text-black-2 xl:block'>Connect bank</p>
        </Button>
      ): (
        <Button onClick={() => open()} className="plaidlink-default">
          <Image 
            src="/icons/connect-bank.svg"
            alt="connect bank"
            width={24}
            height={24}
          />
          <p className='text-[16px] font-semibold text-black-2'>Connect bank</p>
        </Button>
      )}
    </>
  )
}

export default PlaidLink