import getConfig from 'next/config';
import Router from 'next/router';
const { publicRuntimeConfig } = getConfig();
const API_URL = publicRuntimeConfig.API_URL;


export default function Register() {
    //https://nextjs.org/docs/pages/building-your-application/data-fetching/building-forms
    const handleSubmit = async (event) => {
        
        event.preventDefault();
        
        const data = {
          username: event.target.username.value,
          email: event.target.email.value,
          password: event.target.password.value,
        };
        const JSONdata = JSON.stringify(data);
        const endpoint = API_URL + '/register';

        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSONdata,
        };

        try {
            const response = await fetch(endpoint, options);
            const result = await response.json();
            if (response.status === 200) {
              localStorage.setItem("JWT", result.access_token);
              localStorage.setItem("user", JSON.stringify(JSON.parse(atob(result.access_token.split(".")[1])).user));
              console.log(result);
              Router.push("/");
            }
            console.log(result)
        } catch(e) {
            console.error(e);
        }
    };


    return (
      <main className='flex flex-col h-[100vh]'>
        <nav className='bg-[#D29DAC] align-middle flex-initial'>
            <div className="max-w-screen-xl flex flex-wrap items-center justify-between p-4">
                <a href="/" className="flex items-center">
                    <img src="/logo.png" className="h-10 mr-3"/>
                    <span className="self-center text-4xl font-semibold whitespace-nowrap dark:text-white">Audiobooks</span>
                </a>
            </div>
        </nav>
        <div className='flex items-center justify-center h-full flex-auto'>
            <div className='bg-fuchsia-50 p-8 border-slate-300 border-2 border-solid rounded-lg'>
                <form onSubmit={handleSubmit} method="post">
                    <div className='flex flex-col justify-between h-full'>
                        <div className='font-sm text-2xl text-center mb-5'>Register</div>
                        <input type="text" id="username" name="username" placeholder='Username' autoComplete="off" required 
                        className='mb-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg
                                  focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700
                                  dark:border-gray-600 dark:placeholder-gray-400 dark:text-white
                                  dark:focus:ring-blue-500 dark:focus:border-blue-500'
                        />

                        <input type="text" id="email" name="email" placeholder='Email' autoComplete="off" required 
                        className='mb-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg
                                  focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700
                                  dark:border-gray-600 dark:placeholder-gray-400 dark:text-white
                                  dark:focus:ring-blue-500 dark:focus:border-blue-500'
                        />

                        <input type="password" id="password" name="password" placeholder='Password' autoComplete="off" required 
                        className='mb-8 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg
                                  focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700
                                  dark:border-gray-600 dark:placeholder-gray-400 dark:text-white
                                  dark:focus:ring-blue-500 dark:focus:border-blue-500'
                        />
                        <button className='bg-violet-500 hover:bg-violet-700 text-white font-bold py-2 px-4 rounded'
                            type="submit">Register</button>
                    </div>
                </form>
            </div>
        </div>
      </main>
    );
}