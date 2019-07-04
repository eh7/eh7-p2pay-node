var fs = require('fs')
var http = require('http'),
    httpProxy = require('http-proxy');

var proxy = httpProxy.createProxyServer({
  target: {
    protocol: 'ws',
    host: '87.224.39.215',
    port: 9999
  },
  ssl: {
//    key: fs.readFileSync('/home/gavin/blockchain/apps/disberse/dev/certbot/config/live/demo.disberse.com/privkey.pem', 'utf8'),
//    cert: fs.readFileSync('/home/gavin/blockchain/apps/disberse/dev/certbot/config/live/demo.disberse.com/cert.pem', 'utf8')
    key: fs.readFileSync('./certs/privkey.pem', 'utf8'),
    cert: fs.readFileSync('./certs/cert.pem', 'utf8')
  },
  ws: true,
//  changeOrigin: true
}).listen(9997)
/*
proxy.listen(9997)

proxy.on('open', function (proxySocket) {
  proxySocket.on('data',console.log())
})
*/
