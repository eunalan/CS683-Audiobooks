import { useRouter } from 'next/router';
import { useState, useEffect, useMemo } from 'react';
import getConfig from 'next/config';
import Router from 'next/router';
const { publicRuntimeConfig } = getConfig();
const API_URL = publicRuntimeConfig.API_URL;

export default function Listen() {
  const router = useRouter();
  const [audioString, setAudioString] = useState("");
  const [user, setUser] = useState(null);
  const bookParts = useMemo( () => <BookParts/>, [router.isReady] );
  const ttsSettings = useMemo( () => <TTSSettings/>, [router.isReady] );
  
  useEffect(() => {
    let userLocal = JSON.parse(localStorage.getItem("user"));
    if (userLocal === null) {
      Router.push("/");
    }
    else {
      setUser(userLocal);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("JWT");
    localStorage.removeItem("user");
    setUser(null);
    Router.push("/");
  }

  function TTSSettings() {
    const [ttsSettings, setTtsSettings] = useState({
      voice: '',
      speed: 1.0,
      pitch: 0
    });
    const updateTtsSettings = (newState) => {
      setTtsSettings((prevState) => ({
          ...prevState,
          ...newState,
      }));
  };

    useEffect(() => {
      fetchAudioSettings();
    }, []);

    async function fetchAudioSettings() {
      const options = {
        method: 'GET',
        headers: {
            "Authorization": "Bearer " + localStorage.getItem('JWT')
        }
      }
  
      let endpoint = API_URL + "/get_audio_preference";
      let res = await fetch(endpoint, options);
      res = await res.json();
      console.log(res);
      setTtsSettings(res);
    }

    async function saveTTSSettings(e) {
      e.preventDefault();

      const data = ttsSettings; 
      const JSONdata = JSON.stringify(data);
      const endpoint = API_URL + '/set_audio_preference';

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
    }

    return (
      <div>
        <form className='flex flex-col'>
          <label htmlFor='voiceType'>Voice Type</label>
          <select onChange={(e) => updateTtsSettings({voice: e.target.value})} id='voiceType'>
            <option value={"Voice A"} >Voice A</option>
            <option value={"Voice B"} >Voice B</option>
          </select>
          <label htmlFor='speed'>Speed {ttsSettings.speed}</label>
          <input value={ttsSettings.speed} step={0.01} onChange={(e) => updateTtsSettings({speed: e.target.value})} min={0.25} max={4.0} id='speed' type='range'/>
          <label htmlFor='pitch'>Pitch {ttsSettings.pitch}</label>
          <input value={ttsSettings.pitch} step={0.05} onChange={(e) => updateTtsSettings({pitch: e.target.value})} min={-20.0} max={20.0} id='pitch' type='range'/>
          <button onClick={saveTTSSettings}>Save Settings</button>
        </form>
      </div>
    );
  }

  function BookParts() {
    const colors = ['bg-red-50', 'bg-lime-50', 'bg-indigo-50', 'bg-fuchsia-50'];
    const colorsOnHover = ['hover:bg-red-200', 'hover:bg-lime-200', 'hover:bg-indigo-200', 'hover:bg-fuchsia-200'];
    
    const [bookFile, setBookFile] = useState([]);
    const [lastPosition, setLastPosition] = useState(0);

    useEffect(() => {
      if(!router.isReady) return;
      fetchBook();
      fetchLastPosition();
    }, [router.isReady]);
  
    async function fetchLastPosition() {
      const options = {
        method: 'GET',
        headers: {
            "Authorization": "Bearer " + localStorage.getItem('JWT')
        }
      }
  
      let params = new URLSearchParams({ 'bookID': router.query.book_id });
      let endpoint = API_URL + "/get_user_position?" + params;
      let res = await fetch(endpoint, options);
      res = await res.json();
      setLastPosition(res['position']);
      const element = document.getElementById('lastPosition');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }

    async function fetchBook() {
      const options = {
        method: 'GET',
        headers: {
            "Authorization": "Bearer " + localStorage.getItem('JWT')
        }
      }
  
      let params = new URLSearchParams({ 'bookID': router.query.book_id });
      let endpoint = API_URL + "/get_book_file?" + params;
      let res = await fetch(endpoint, options);
      res = await res.json();
      setBookFile(res.book_file);
    }

    async function playAudioFrom(bookPart) {
        const options = {
          method: 'GET',
          headers: {
              "Authorization": "Bearer " + localStorage.getItem('JWT')
          }
        }
        let params = new URLSearchParams({ 'bookID': router.query.book_id, 'bookPart': bookPart});
        let endpoint = API_URL + '/get_book_audio' + '?' + params;
        let res = await fetch(endpoint, options);
        res = await res.json();
        setAudioString(res['audio']);
        //let snd = new Audio("data:audio/mp3;base64," + res['audio']);
        //snd.play()
    }
    
    //console.log(book);
    let parts = [];
    let id = '';
    for (let i = 0; i < bookFile.length; i++) {
      if (i == lastPosition) {
        id = 'lastPosition';
      }
      else {
        id = '';
      }
      parts.push(
          <a className='flex flex-row' key={i} onClick={() => playAudioFrom(i)} href='#'>
            <div className='my-2'>Part {i}</div>
            <div className={'pl-8 pb-3 w-100 flex-1 ' + colors[i%4] + ' ' + colorsOnHover[i%4]}>
              {bookFile[i]}
            </div>
          </a>
      )
    }
    return (<>{parts}</>);

  }

  return (
    <main>
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
      <div className='flex flex-row'>
        <div className='flex-1'>
          <p>Listening to Book_ID: {router.query.book_id}</p>
          <img className='border border-solid border-slate-300 border-2' src={'/cover_medium/' + router.query.book_id + '-cover-medium.png'}></img>
        </div>
        <div className='flex-1 whitespace-pre-line h-[100vh] overflow-y-auto'>
          {
            bookParts
          //<BookParts/>
          }
        </div>
        <div className='ml-5 mr-5 flex-1'>
          {ttsSettings}
          <audio src={'data:audio/mp3;base64,' + audioString} controls></audio>
        </div>
      </div>
    </main>

  )
}