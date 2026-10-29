import BankCard from '@/components/BankCard';
import ConnectBankButton from '@/components/ConnectBankButton';
import HeaderBox from '@/components/HeaderBox'
import { getAccounts } from '@/lib/actions/bank.actions';
import { getLoggedInUser } from '@/lib/actions/user.actions';
import { redirect } from 'next/navigation';
import React from 'react'

const MyBanks = async () => {
  const loggedIn = await getLoggedInUser();

  if (!loggedIn) redirect('/sign-in');

  const accounts = await getAccounts({
    userId: loggedIn.$id
  })

  const accountList: Account[] = accounts?.data ?? [];

  return (
    <section className='flex'>
      <div className="my-banks">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <HeaderBox
            title="My Bank Accounts"
            subtext="Effortlessly manage your banking activites."
          />

          <ConnectBankButton user={loggedIn} />
        </div>

        <div className="space-y-4">
          <h2 className="header-2">
            Your cards
          </h2>

          {accountList.length === 0 ? (
            <p className="text-14 text-gray-600">
              You have no accounts yet. Use “Connect bank” to add your first
              account and start transferring funds.
            </p>
          ) : (
            <div className="flex flex-wrap gap-6">
              {accountList.map((a: Account) => (
                <BankCard
                  key={a.appwriteItemId}
                  account={a}
                  userName={loggedIn.firstName}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default MyBanks;
