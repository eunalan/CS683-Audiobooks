import { useState, useEffect } from 'react';
import getConfig from 'next/config';
const { publicRuntimeConfig } = getConfig();
const API_URL = publicRuntimeConfig.API_URL;

export default function BookDisplay(props) {
    //const [books, setBooks] = useState([]);
    //const [booksInPage, setBooksInPage] = useState(0);
    //const [numPages, setNumPages] = useState(0);
    //const [currentPage, setCurrentPage] = useState(0);

    const [booksState, setBooksState] = useState({
        books: [],
        booksInPage: 0,
        numPages: 0,
        currentPage: 0
    });

    const updateBookState = (newState) => {
        setBooksState((prevState) => ({
            ...prevState,
            ...newState,
        }));
    };

    useEffect(() => {
        fetchBooks();
    }, []);

    useEffect(() => {
        console.log("FETCH PARAMS:", props.fetchParams);
        console.log(new URLSearchParams(props.fetchParams));
        fetchBooks();
    }, [props.fetchParams]);

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
        let endpoint = API_URL + props.api_endpoint + '?' + params;
        if (props.fetchParams !== undefined) {
            endpoint += '&' + new URLSearchParams(props.fetchParams);
        }
        console.log(endpoint);
        let res = await fetch(endpoint, options);
        res = await res.json();
        console.log(res);
        updateBookState({
            books: res['books'],
            booksInPage: res['booksInPage'],
            numPages: res['numPages'],
            currentPage: pageNo + 1
        })
        //setBooks(res['books']);
        //setBooksInPage(res['booksInPage']);
        //setNumPages(res['numPages']);
        //setCurrentPage(pageNo + 1);
    }

    function FavButton(book) {
        const [isFavorited, setIsFavorited] = useState(false);
        
        useEffect(() => {
            setIsFavorited(Boolean(book.book.is_favorited));
        }, []);
        
        async function favorite(book) {
            console.log(book);
            const data = {
                bookID: book.book.book_id,
                favorite: !isFavorited,
            };
            console.log(data);
            const JSONdata = JSON.stringify(data);
            const endpoint = API_URL + '/favorite';
            const options = {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  "Authorization": "Bearer " + localStorage.getItem('JWT')
                },
                body: JSONdata,
              };
      
              try {
                  const response = await fetch(endpoint, options);
                  const result = await response.json();
                  if (response.status === 200) {
                    setIsFavorited(result.favorite);
                    console.log(isFavorited);
                  }
              } catch(e) {
                  console.error(e);
              }
        }

        function handleClick() {
            favorite(book);
        }

        return (
            <button onClick={handleClick}>
                <img className='w-5 h-5' src={'/star' + (isFavorited ? '_filled' : '') + '.svg'}></img>
            </button>
        )
    }

    function DisplayBooks(numRows, numCols) {
        console.log("FETCH PARAMS:", props.fetchParams);
        //let b = [];
        //for (const book of books) {
        //    b.push(<div><a href={'/books/' + book['book_id']}>{JSON.stringify(book)}</a></div>);
        //}
        if (numRows.numRows === undefined) {
            numRows = 5;
        }
        if (numCols.numCols === undefined) {
            numCols = 5;
        }
        let rows = [];
        for (let i = 0; i < numRows; i++) {
            let row = []
            for (let j = 0; j < numCols; j++) {
                if (i * numCols + j >= booksState.booksInPage) {
                    row.push(<div className='mx-1 my-1 flex-1'></div>);
                    continue;
                }
                let book = booksState.books[i * numCols + j];
                let cur = (
                    <div className='mx-1 my-1 flex flex-1 flex-row border-slate-500 border-2 border-solid rounded-md'>
                        <img className='object-none h-[100px] w-[66px] min-h-[100px] min-w-[66px]' src={'/cover_small/' + book['book_id'] + '-cover-small.png'}></img>
                        <div className='ml-4 mr-2'>
                            <div>{book['title']}</div>
                            <div>{book['author_name']}</div>
                            <div className='flex flex-row'>
                                <FavButton book={book}/>
                                <a className='bg-blue-500 hover:bg-blue-700 text-white font-bold mx-3 mt-2 py-1 px-3 rounded' href={'/books/' + book['book_id']}>Listen</a>
                            </div>
                        </div>
                    </div>)
                row.push(cur);
            }
            rows.push(<div className='flex flex-row'>{row}</div>)
        }
        return <div>{rows}</div>;
    }

    function GeneratePageNav() {
        let pnav = [];

        if (booksState.currentPage == 1) {
            pnav.push(<div></div>);
        }
        else {
            pnav.push(<button onClick={() => fetchBooks(booksState.currentPage - 1)} className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'>Previous Page</button>);
        }

        let page_nums = [];
        for (let i = 0; i < booksState.numPages; i++) {
            page_nums.push(<option value={String(i + 1)}>{i + 1}</option>)
        }

        pnav.push(
            <div>
                Page
                <select value={booksState.currentPage} onChange={e => fetchBooks(e.target.value)} name="page_nums" id="page_nums">
                    {page_nums}
                </select>
                of {booksState.numPages}
            </div>
        );

        if (booksState.currentPage == booksState.numPages) {
            pnav.push(<div></div>);
        }
        else {
            pnav.push(<button onClick={() => fetchBooks(booksState.currentPage + 1)} className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'>Next Page</button>);
        }
        return (
            <div className='flex flex-row justify-between'>
                {pnav}
            </div>
        );
    }

    return (
        <>
            {booksState.books.length > 0 &&
                <div className='mx-20'>
                    <DisplayBooks/>
                    {booksState.numPages != 1 && <GeneratePageNav/>}
                </div>
            }
        </>
    );
}