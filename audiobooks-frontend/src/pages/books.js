import { useState, useEffect } from 'react';
import Router from 'next/router';
import BookDisplay from '@/components/BookDisplay';
import getConfig from 'next/config';
const { publicRuntimeConfig } = getConfig();
const API_URL = publicRuntimeConfig.API_URL;

export default function Books() {
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [selectedAuthor, setSelectedAuthor] = useState(0);

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
      fetchCategories();
      fetchAuthors();
    }
  }, [])

  async function fetchCategories() {
    const options = {
        method: 'GET',
        headers: {
            "Authorization": "Bearer " + localStorage.getItem('JWT')
        }
    }
    let endpoint = API_URL + '/get_categories';
    let res = await fetch(endpoint, options);
    res = await res.json();
    setCategories(res['categories']);
  }

  async function fetchAuthors() {
    const options = {
        method: 'GET',
        headers: {
            "Authorization": "Bearer " + localStorage.getItem('JWT')
        }
    }
    let endpoint = API_URL + '/get_authors';
    let res = await fetch(endpoint, options);
    res = await res.json();
    setAuthors(res['authors']);
  }

  function CategorySelector() {
    //console.log(categories);
    let cats = [];
    cats.push(<option value={0}>All Categories</option>)
    for (let i = 0; i < categories.length; i++) {
      let c = categories[i];
      cats.push(<option key={c.category_id} value={c.category_id}>{c.name + ' (' + c.count + ')'}</option>)
    }

    return (
        <div className='mr-20'>
          <label>Category:</label>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} name="categories" id="categories">
              {cats}
          </select>
        </div>
    );
  }

  function AuthorSelector() {
    //console.log(categories);
    let auths = [];
    auths.push(<option value={0}>All Authors</option>)
    for (let i = 0; i < authors.length; i++) {
      let a = authors[i];
      auths.push(<option key={a.author_id} value={a.author_id}>{a.name + ' (' + a.count + ')'}</option>)
    }

    return (
        <div>
          <label>Author:</label>
          <select value={selectedAuthor} onChange={(e) => setSelectedAuthor(e.target.value)} name="authors" id="authors">
              {auths}
          </select>
        </div>
    );
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
          <div className='h-full flex-auto'>
            <div className='mx-20 flex flex-row'>
              {(categories && selectedAuthor == 0) && <CategorySelector/>}
              {(authors && selectedCategory == 0) && <AuthorSelector/>}
            </div>
            <div>
              {user && <BookDisplay api_endpoint='/get_books' fetchParams={{category: selectedCategory, author: selectedAuthor}}/>}
            </div>
          </div>
        </main>
    </>
  )
}