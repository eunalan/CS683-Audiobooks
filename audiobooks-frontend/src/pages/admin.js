import { useState, useEffect } from 'react';
import Router from 'next/router';
import AdminBookDisplay from '@/components/AdminBookDisplay';
import getConfig from 'next/config';
const { publicRuntimeConfig } = getConfig();
const API_URL = publicRuntimeConfig.API_URL;

export default function Admin() {
    const [user, setUser] = useState(null);

    const logout = () => {
        localStorage.removeItem("JWT");
        localStorage.removeItem("user");
        setUser(null);
        Router.push("/");
    }

    useEffect(() => {
        let userLocal = JSON.parse(localStorage.getItem("user"));
        console.log(userLocal);
        if (userLocal === null || !userLocal.is_admin) {
          Router.push("/");
        }
        else {
          setUser(userLocal);
        }
      }, [])

    function AddBookPanel() {
        const [file, setFile] = useState(null);
        //const [fileContent, setFileContent] = useState(null);
        const [bookInfo, setBookInfo] = useState({
            title: "",
            author_name: "",
            publish_date: "",
            categories: "",
            content: null
        });
        
        const updateBookInfo = (newState) => {
            setBookInfo((prevState) => ({
                ...prevState,
                ...newState,
            }));
        };

        function handleFileInput(e) {
            if (e.target.files && e.target.files[0]) {
                const selectedFile = e.target.files[0];
                setFile(selectedFile);
                
                const reader = new FileReader();
                reader.onloadend = function(event) {
                    //setFileContent(event.target.result);
                    updateBookInfo({content: event.target.result});
                };
                reader.readAsText(selectedFile);
            }
        }

        async function uploadBook(event) {
            event.preventDefault();

            const data = bookInfo; 
            // {
            //     title: event.target.bookName.value,
            //     author_name: event.target.authorName.value,
            //     publish_date: event.target.publishDate.value,
            //     categories: event.target.categories.value,
            //     content: fileContent
            // };
            const JSONdata = JSON.stringify(data);
            const endpoint = API_URL + '/add_book';
    
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": "Bearer " + localStorage.getItem('JWT')
                },
                body: JSONdata,
            };
            const response = await fetch(endpoint, options);
            const result = await response.json();

            setFile(null);
            setBookInfo({
                title: "",
                author_name: "",
                publish_date: "",
                categories: "",
                content: null
            });
        }

        return (
            <div className='flex flex-row'>
                <div>
                    <div className='mx-20 mt-5 text-2xl font-semibold'>Add a book</div>
                    <form className='mx-20 flex flex-row' onSubmit={uploadBook}>
                        <div className='flex flex-col'>
                            <input type="file" onChange={handleFileInput} />
                            <div>{file && `${file.name} - ${file.type}`}</div>
                        </div>
                        <div>
                            <input onChange={(e) => updateBookInfo({title: e.target.value})}
                                value={bookInfo.title} type="text" id="bookName" name="bookName" placeholder='Book Name' autoComplete="off" required
                                className='mb-2 bg-gray-50 border border-black text-black text-sm rounded-lg
                                        focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5'
                            />
                            <input onChange={(e) => updateBookInfo({author_name: e.target.value})}
                                value={bookInfo.author_name} type="text" id="authorName" name="authorName" placeholder='Author Name' autoComplete="off" required
                                className='mb-2 bg-gray-50 border border-black text-black text-sm rounded-lg
                                        focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5'
                            />
                        </div>
                        <div>
                            <input onChange={(e) => updateBookInfo({publish_date: e.target.value})}
                                value={bookInfo.publish_date} type="text" id="publishDate" name="publishDate" placeholder='Publish Date: YYYY-MM-DD' autoComplete="off" required
                                className='mb-2 mx-2 bg-gray-50 border border-black text-black text-sm rounded-lg
                                        focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5'
                            />
                            <input onChange={(e) => updateBookInfo({categories: e.target.value})}
                                value={bookInfo.categories} type="text" id="categories" name="categories" placeholder='Categories: Separated by "|"s' autoComplete="off" required
                                className='mb-2 mx-2 bg-gray-50 border border-black text-black text-sm rounded-lg
                                        focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5'
                            />
                        </div>
                        <button disabled={file === null} className='mx-5 bg-blue-500 hover:bg-blue-700
                            disabled:opacity-25 text-white font-bold py-2 px-4 rounded'>ADD</button>
                    </form>
                </div>
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
                    <img src="logo.png" className="h-10 mr-3" />
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
                {AddBookPanel()}
                <div className='mx-20 mt-5 text-2xl font-semibold'>Delete books</div>
                {AdminBookDisplay('/get_books')}
            </div>
            </main>
        </>
    )
}