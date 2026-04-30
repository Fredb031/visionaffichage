import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
      // Canonicalize quote route → /soumission
      {
        source: '/:locale(fr-ca|en-ca)/devis',
        destination: '/:locale/soumission',
        permanent: true,
      },
      {
        source: '/:locale(fr-ca|en-ca)/quote',
        destination: '/:locale/soumission',
        permanent: true,
      },
      // Canonicalize discovery kit → /kit
      {
        source: '/:locale(fr-ca|en-ca)/kit-decouverte',
        destination: '/:locale/kit',
        permanent: true,
      },
      {
        source: '/:locale(fr-ca|en-ca)/discovery-kit',
        destination: '/:locale/kit',
        permanent: true,
      },
      // Header link uses /catalogue; canonical PLP is /produits
      {
        source: '/:locale(fr-ca|en-ca)/catalogue',
        destination: '/:locale/produits',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
