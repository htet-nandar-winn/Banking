import HeaderBox from '@/components/HeaderBox'
import RecentTransactions from '@/components/RecentTransactions';
import RightSidebar from '@/components/RightSidebar';
import TotalBalanceBox from '@/components/TotalBalanceBox';
import ConnectBankButton from '@/components/ConnectBankButton';
import { getAccount, getAccounts } from '@/lib/actions/bank.actions';
import { getLoggedInUser } from '@/lib/actions/user.actions';
import { redirect } from 'next/navigation';

const Home = async ({ searchParams: { id, page } }: SearchParamProps) => {
  const currentPage = Number(page as string) || 1;
  const loggedIn = await getLoggedInUser();

  if (!loggedIn) redirect('/sign-in');

  const accounts = await getAccounts({ 
    userId: loggedIn.$id 
  })

  if(!accounts) return;
  
  const accountsData = accounts?.data ?? [];
  const appwriteItemId = (id as string) || accountsData[0]?.appwriteItemId;

  const account = appwriteItemId ? await getAccount({ appwriteItemId }) : undefined;

  return (
    <section className="home">
      <div className="home-content">
        <header className="home-header">
          <HeaderBox 
            type="greeting"
            title="Welcome"
            user={loggedIn?.firstName || 'Guest'}
            subtext="Access and manage your account and transactions efficiently."
          />

          <TotalBalanceBox 
            accounts={accountsData}
            totalBanks={accounts?.totalBanks}
            totalCurrentBalance={accounts?.totalCurrentBalance}
          />
        </header>

        {accountsData.length === 0 && (
          <section className="mb-6 flex flex-col items-start gap-4 rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="header-2">Add your first bank account</h2>
            <p className="text-14 text-gray-600">
              You have no accounts yet. Add one to see balances, transactions
              and to send transfers.
            </p>
            <ConnectBankButton user={loggedIn} />
          </section>
        )}

        <RecentTransactions 
          accounts={accountsData}
          transactions={account?.transactions}
          appwriteItemId={appwriteItemId}
          page={currentPage}
        />
      </div>

      <RightSidebar 
        user={loggedIn}
        transactions={account?.transactions}
        banks={accountsData?.slice(0, 2)}
      />
    </section>
  )
}

export default Home