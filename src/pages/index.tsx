import Head from 'next/head';
import DeviceTracker from '../components/device-tracker';

export default function Home() {
  return (
    <>
      <Head>
        <title>Device Tracker Dashboard</title>
        <meta name="description" content="Device status tracking dashboard" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="min-h-screen bg-gray-100 py-10">
        <DeviceTracker />
      </main>
    </>
  );
}