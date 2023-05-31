/** @type {import('next').NextConfig} */
const nextConfig = {
    //output: 'export',
    //trailingSlash: true,
    //assetPrefix: './',
    publicRuntimeConfig: {
        API_URL: "https://api-dot-cs683-audiobooks.appspot.com"
        //API_URL: "http://localhost:8000"
    }
}

module.exports = nextConfig
