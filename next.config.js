/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@stellar/stellar-sdk', 'openai'],
}

module.exports = nextConfig
