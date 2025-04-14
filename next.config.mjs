/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  compiler: {
    removeConsole: {
      exclude: ['error'],
    },
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // Enable WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
      layers: true,
    };
    
    // Add specific handling for WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/wasm/[name].[hash][ext]',
      },
    });
    
    return config;
  },
};

export default nextConfig;
