const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Add error handling middleware
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Serve React app static files
app.use(express.static(__dirname));

// Proxy WordPress requests to WordPress service
const BLOG_URL = process.env.BLOG_URL || 'https://vfms-blog-jkxw.onrender.com';
console.log('Blog service URL:', BLOG_URL);

app.use('/blog', createProxyMiddleware({
  target: BLOG_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/blog': '', // Remove /blog prefix when forwarding to WordPress
  },
  onProxyReq: (proxyReq, req, res) => {
    // Update the host header
    const blogHost = new URL(BLOG_URL).host;
    proxyReq.setHeader('host', blogHost);
    
    // Add WordPress admin headers
    if (req.path && req.path.includes('/wp-admin')) {
      proxyReq.setHeader('X-Forwarded-Proto', 'https');
      proxyReq.setHeader('X-Forwarded-Host', 'vfms-aa2w.onrender.com');
      proxyReq.setHeader('X-Forwarded-For', req.ip || req.connection.remoteAddress);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Update any absolute URLs in the response
    let body = '';
    proxyRes.on('data', (chunk) => {
      body += chunk;
    });
    proxyRes.on('end', () => {
      // Replace WordPress URLs with /blog URLs
      body = body.replace(new RegExp(BLOG_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '/blog');
      
      // Additional WordPress admin fixes
      if (req.path && req.path.includes('/wp-admin')) {
        // Fix admin URLs
        body = body.replace(/\/wp-admin/g, '/blog/wp-admin');
        body = body.replace(/\/wp-login\.php/g, '/blog/wp-login.php');
        body = body.replace(/\/wp-json/g, '/blog/wp-json');
        body = body.replace(/\/wp-includes/g, '/blog/wp-includes');
        
        // Fix AJAX URLs
        body = body.replace(/ajaxurl\s*:\s*['"][^'"]*['"]/g, 'ajaxurl: "/blog/wp-admin/admin-ajax.php"');
        
        // Fix form actions
        body = body.replace(/action=['"][^'"]*\/wp-admin[^'"]*['"]/g, (match) => {
          return match.replace(/\/wp-admin/g, '/blog/wp-admin');
        });
      }
      
      res.end(body);
    });
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(503).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Blog Service Temporarily Unavailable</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1 class="error">Blog Service Temporarily Unavailable</h1>
        <p>We're working to restore the blog service. Please try again later.</p>
        <a href="/">← Back to Main Site</a>
      </body>
      </html>
    `);
  }
}));

// Handle React Router (catch all handler)
app.get('*', (req, res) => {
  // Don't serve React for /blog routes
  if (req.path.startsWith('/blog')) {
    return res.status(404).send('Blog not found');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Add error handling for server startup
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`React app: http://localhost:${PORT}`);
  console.log(`WordPress blog: http://localhost:${PORT}/blog`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});
