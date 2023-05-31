import { useState, useEffect } from 'react';
import getConfig from 'next/config';
const { publicRuntimeConfig } = getConfig();
const API_URL = publicRuntimeConfig.API_URL;

export default function AdminBookDisplay(api_endpoint, fetchParams) {
    const [books, setBooks] = useState([]);
    const [booksInPage, setBooksInPage] = useState(0);
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);

    useEffect(() => {
        fetchBooks();
    }, []);

    async function fetchBooks(pageNo) {
        const options = {
            method: 'GET',
            headers: {
                "Authorization": "Bearer " + localStorage.getItem('JWT')
            }
        }
        if (pageNo === undefined) {
            pageNo = 0;
        }
        else {
            pageNo -= 1;
        }
        let params = new URLSearchParams({ 'page': pageNo });
        let endpoint = API_URL + api_endpoint + '?' + params;
        if (fetchParams !== undefined) {
            endpoint += new URLSearchParams(fetchParams);
        }
        let res = await fetch(endpoint, options);
        res = await res.json();
        setBooks(res['books']);
        setBooksInPage(res['booksInPage']);
        setNumPages(res['numPages']);
        setCurrentPage(pageNo + 1);
    }

    async function deleteBook(bookID) {
        console.log(bookID);
        const options = {
            method: 'GET',
            headers: {
                "Authorization": "Bearer " + localStorage.getItem('JWT')
            }
        }
        let params = new URLSearchParams({ 'bookID': bookID });
        let endpoint = API_URL + '/delete_book' + '?' + params;
        let res = await fetch(endpoint, options);
        res = await res.json();
        fetchBooks();
    } 

    function displayBooks(numRows, numCols) {
        //let b = [];
        //for (const book of books) {
        //    b.push(<div><a href={'/books/' + book['book_id']}>{JSON.stringify(book)}</a></div>);
        //}
        if (numRows === undefined) {
            numRows = 5;
        }
        if (numCols === undefined) {
            numCols = 5;
        }
        let rows = [];
        for (let i = 0; i < numRows; i++) {
            let row = []
            for (let j = 0; j < numCols; j++) {
                if (i * numCols + j >= booksInPage) {
                    row.push(<div className='mx-1 my-1 flex-1'></div>);
                    continue;
                }
                let book = books[i * numCols + j];
                let cur = (
                    <div className='mx-1 my-1 flex flex-1 flex-row border-slate-500 border-2 border-solid rounded-md'>
                        <img className='object-none h-[100px] w-[66px] min-h-[100px] min-w-[66px]' src={'/cover_small/' + book['book_id'] + '-cover-small.png'}></img>
                        <div className='ml-4 mr-2'>
                            <div>{book['title']}</div>
                            <div>{book['author_name']}</div>
                            <button onClick={() => deleteBook(book['book_id'])} className='bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded'>DELETE</button>
                        </div>
                    </div>)
                row.push(cur);
            }
            rows.push(<div className='flex flex-row'>{row}</div>)
        }
        return <div>{rows}</div>;
    }

    function generatePageNav() {
        let pnav = [];

        if (currentPage == 1) {
            pnav.push(<div></div>);
        }
        else {
            pnav.push(<button onClick={() => fetchBooks(currentPage - 1)} className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'>Previous Page</button>);
        }

        let page_nums = [];
        for (let i = 0; i < numPages; i++) {
            page_nums.push(<option value={String(i + 1)}>{i + 1}</option>)
        }

        pnav.push(
            <div>
                Page
                <select value={currentPage} onChange={e => fetchBooks(e.target.value)} name="page_nums" id="page_nums">
                    {page_nums}
                </select>
                of {numPages}
            </div>
        );

        if (currentPage == numPages) {
            pnav.push(<div></div>);
        }
        else {
            pnav.push(<button onClick={() => fetchBooks(currentPage + 1)} className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'>Next Page</button>);
        }
        return (
            <div className='flex flex-row justify-between'>
                {pnav}
            </div>
        );
    }

    return (
        <>
            {books.length > 0 &&
                <div className='mx-20'>
                    {displayBooks()}
                    {generatePageNav()}
                </div>
            }
        </>
    );
}