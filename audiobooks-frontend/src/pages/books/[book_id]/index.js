import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Router from 'next/router';
import Link from 'next/link';
import getConfig from 'next/config';
const { publicRuntimeConfig } = getConfig();
const API_URL = publicRuntimeConfig.API_URL;
 
export default function Book() {
  const router = useRouter();
  const [book, setBook] = useState(null);
  const [user, setUser] = useState(null);

  async function fetchBook() {
    const options = {
      method: 'GET',
      headers: {
        "Authorization": "Bearer " + localStorage.getItem('JWT')
      }
    }
    let params = new URLSearchParams({'bookID': router.query.book_id});
    let res = await fetch(API_URL + '/get_book?' + params, options);
    res = await res.json();
    setBook(res);
  }

  const logout = () => {
    localStorage.removeItem("JWT");
    localStorage.removeItem("user");
    setUser(null);
    Router.push("/");
  }

  useEffect(() => {
    let userLocal = JSON.parse(localStorage.getItem("user"));
    if (userLocal === null) {
      Router.push("/");
    }
    else {
      setUser(userLocal);
      if(!router.isReady) return;
      fetchBook();
    }
}, [router.isReady])

  function Categories() {
    let cats = [];
    for (let i = 0; i < book.categories.length; i++) {
      cats.push(<div>{String(i+1) + '. ' + book.categories[i]}</div>);
    }
    return <div>
      <div>Categories:</div>{
      
      cats
    }</div>
  }

  return (
    <>
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
            </div>
            <div className='flex flex-col text-right'>
                <div className='text-2xl font-semibold'>
                {user && user['username']}
                </div>
                <div>
                <button onClick={logout}>Logout</button>
                </div>
            </div>
            </div>
        </nav>
        <div className='flex flex-row h-full flex-auto'>
          <div className='flex-1'></div>
          <div className='flex-1'>
            {book  &&
              <div className='px-[25%] bg-fuchsia-50 border-solid border-slate-300 border-2 mx-20 mt-5 text-2xl font-semibold'>
                <img src={'/cover_medium/' + router.query.book_id + '-cover-medium.png'}></img>
                <div className='mt-5 text-2xl font-semibold'>{book.title}</div>
                <div className='mt-5 text-2xl font-semibold'>by {book.author_name}</div>
                <div className='mt-5 mb-5'><Categories/></div>
                <div><Link className='bg-blue-500 hover:bg-blue-700 text-white font-bold mt-2 py-1 px-3 rounded' href={"/books/" + router.query.book_id + '/listen'}>Listen</Link></div>
              </div>
            }
          </div>
          <div className='flex-1'></div>
        </div>
        </main>
    </>
  )
}