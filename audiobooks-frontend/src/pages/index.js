import { useState, useEffect } from 'react';
import Router from 'next/router';
import BookDisplay from '@/components/BookDisplay';
import Link from 'next/link';

function HomeLoggedIn(user, setUser) {
  const logout = () => {
    localStorage.removeItem("JWT");
    localStorage.removeItem("user");
    setUser(null);
    Router.push("/");
  }

  return (
    <main className='flex flex-col h-[100vh]'>
      <nav className='w-full bg-[#D29DAC] align-middle flex-initial'>
        <div className="flex flex-wrap items-center justify-between p-4">
          <div className='flex flex-row'>
            <a href="/" className="flex items-center">
              <img src="/logo.png" className="h-10 mr-3" />
              <span className="self-center text-5xl font-semibold whitespace-nowrap dark:text-white">Audiobooks</span>
            </a>
            <a href={'/books'} className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-2 px-4 rounded-full
                ml-10 self-center text-2xl font-semibold whitespace-nowrap dark:text-white">Books</a>
            {user.is_admin && <a href={'/admin'} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full
                ml-10 self-center text-2xl font-semibold whitespace-nowrap dark:text-white">Admin</a>}
          </div>
          <div className='flex flex-col text-right'>
            <div className='text-2xl font-semibold'>
              {user['username']}
            </div>
            <div>
              <button onClick={logout}>Logout</button>
            </div>
          </div>
        </div>
      </nav>
      <div className='h-full flex-auto'>
        <div>
          <div className='mx-20 mt-5 text-2xl font-semibold'>Your Favorite Books</div>
          <div><BookDisplay api_endpoint='/get_favorite_books' /></div>
        </div>
      </div>
    </main>

  )
}

function HomeLoggedOut() {
  return (
    <main className='flex flex-col h-[100vh]'>
      <nav className='w-full bg-[#D29DAC] align-middle flex-initial'>
        <div className="flex flex-wrap items-center justify-between p-4">
          <div className='flex flex-row'>
            <a href="/" className="flex items-center">
              <img src="/logo.png" className="h-10 mr-3" />
              <span className="self-center text-5xl font-semibold whitespace-nowrap dark:text-white">Audiobooks</span>
            </a>
          </div>
          <div>
            <a className='text-3xl font-semibold' href={'/login/'}>Login</a>
          </div>
        </div>
      </nav>
      <div className='h-full flex-auto flex flex-row'>
        <img className='h-5/6' src='/homepage.png'></img>
        <div className='text-[84px] font-semibold'>
          <div>
            Powered by the Google Cloud<br/>
            Text-to-Speech<br/>API we bring you<br/>the new Audiobook experience
          </div>
          <a className='flex flex-row items-center' href='/login'>
              <div className='text-violet-700'>Try it now</div>
              <svg className='ml-5' width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16.25 5H53M53 5L53 41.75M53 5L4 54" stroke="#6D28D9" strokeWidth="9"/>
              </svg>
          </a>
          
        </div>
      </div>
    </main>
  )
}

export default function Home() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(JSON.parse(localStorage.getItem("user")));
  }, []);
  
  return (
      <>{user ? HomeLoggedIn(user, setUser) : HomeLoggedOut()}</>
    )
  }