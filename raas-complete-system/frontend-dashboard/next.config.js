/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    API_URL: process.env.API_URL || 'https://tradiac-api-url.run.app',
  },
}

module.exports = nextConfig