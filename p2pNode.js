/* eslint-disable no-console */
'use strict'

process.setMaxListeners(10)
console.log("MaxListeners: " + process.getMaxListeners())
//console.log(process.setMaxListeners(0))
//process.exit()

const longjohn = require('longjohn')

const contract = require('./contract')
const lodash = require('lodash')

const libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const WebSockets = require('libp2p-websockets')
const WebRTCStar = require('libp2p-webrtc-star')
const SPDY = require('libp2p-spdy')
//const tls = require('libp2p-tls')
const SECIO = require('libp2p-secio')
const KadDHT = require('libp2p-kad-dht')
const Protector = require('libp2p-pnet')
const PeerInfo = require('peer-info')
const PeerId   = require('peer-id')
const waterfall = require('async/waterfall')
const parallel = require('async/parallel')
const series = require('async/series')
const pull = require('pull-stream')
const defaultsDeep = require('@nodeutils/defaults-deep')

const Circuit = require('libp2p-circuit')
const multiaddr = require('multiaddr')
const Catch = require('pull-catch')
const ethWallet = require('ethereumjs-wallet')
const ethUtil = require('ethereumjs-util')
const ethTx = require('ethereumjs-tx')

require('./wsProxy.js')

const directorId = require('./director-id.json')
/*
const NodeRSA = require('node-rsa')
PeerId.createFromPrivKey(directorId.privKey, (err, id) => {
  console.log(id.toHexString())
})
*/
/*
const directorIdKeyData = "-----BEGIN PUBLIC KEY----- " + directorId.privKey + " -----END PUBLIC KEY-----";
//console.log(directorIdKeyData)
//process.exit()
const directorIdKey = new NodeRSA()//directorIdKeyData)
//directorIdKey.importKey(directorIdKeyData);
*/

const Web3 = require('web3')
const web3_provider = "ws://10.0.0.10:8548"
const web3 = new Web3(new Web3.providers.WebsocketProvider(web3_provider))

class MyBundle extends libp2p {
  constructor (_options) {
    const wrtcStar = new WebRTCStar({ id: _options.peerInfo.id, key: 'eh7peerjs' })
    const defaults = {
      modules: {
        transport: [ TCP, WebSockets, wrtcStar ],
        streamMuxer: [ SPDY ],
        connEncryption: [ SECIO ],
//        connProtector: new Protector(swarmId),
        dht: KadDHT
      },
      config: {
        dht: {
          kBucketSize: 20
        },
        relay: {
          enabled: true,
          hop: {
            enabled: true,
            active: true
          }
        },
        EXPERIMENTAL: {
        // dht must be enabled
          pubsub: true,
          dht: true
        }
      }
    }

    super(defaultsDeep(_options, defaults))
  }
}

let node


let peerCheck = []
let peerMap = []

//ection getContractBalances(callback) {
const getGasPriceAndNonce = () => {
}

const getContractBalances = (msg, callerAddress, callback) => {
  let disberse_abi = contract.abi;
  let owner_address = contract.owner_address;
  let contract_address = contract.contract_address;
  let Disberse = new web3.eth.Contract(disberse_abi, contract_address);

  let results = []
  let errors  = []
  
  for(let i=0; i<4; i++) {

    let tokenId = i

    Disberse.methods.getBalance(callerAddress,tokenId).call({from:callerAddress}, function(err,res) {
      if(err){
        errors.push(err)
      } else {
        var return_val = {id:tokenId,balance:Number(res).toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,')}
        results.push(return_val)

        if(i == 3) {
          if(errors.length > 0)
            callback(errors)
          else {

            let sendToPeerId = PeerId.createFromB58String(msg.from)
            console.log("id: " + sendToPeerId)
            PeerInfo.create(sendToPeerId, (err, sendToPeerInfo) => {

              node.dialProtocol(sendToPeerInfo, 
                '/disberse/txBalances', 
                (err, conn) => {
                if(err) console.log(err)
                else if(typeof results[3].balance === 'undefined') console.log("balance[3] error")
                else {
                  console.log("sending tx return")
                  pull(
//                    pull.values(["hello"]),
                    pull.values([results[0].balance,
                      results[1].balance,
                      results[2].balance,
                      results[3].balance]),
                    conn
                  )
                  console.log("sent /disberse/txBalances")
                  callback(results)
                }              
              })
            })
          }
        }
      }
    })

  }

/*
  PeerId.createFromPrivKey(directorId.privKey, (err, id) => {
    const myPrivateKey = Buffer.from(id.toHexString().substr(4), 'hex')
    const myPublicKey = ethUtil.privateToAddress(myPrivateKey).toString('hex')
    const myAddress = ethUtil.privateToAddress(myPrivateKey).toString('hex')
    const myWallet = ethWallet.fromPrivateKey(myPrivateKey)

    web3.eth.getGasPrice(function(err, gasPrice) {
      if(err)
        console.log(err)
    
      let gasPriceHex = web3.utils.toHex(gasPrice)
      let gasLimitHex = web3.utils.toHex(2000000)

      let amount = 1
      let typeId = 0

      
      //getBalance(address account_address, uint token_type_in)
      Disberse.methods.getBalance(myAddress,typeId).estimateGas(function(error, gasAmount){
        if(error)
          console.log(error)
        else {
          callback("Gas estimnate for getBalance(" + myAddress + "," + typeId +") ")
          web3.eth.getTransactionCount("0x"+myAddress, function(err,nonce) {
            if(err)
              console.log(err)

            let nonceHex = web3.utils.toHex(nonce)
            let transValue = web3.utils.toHex(0)

            let lodash = require('lodash')
            let this_function_abi = lodash.find(contract.abi, { name: 'getBalance' })
            let payloadData = [myAddress,typeId]
            let txPayloadData = web3.eth.abi.encodeFunctionCall(this_function_abi, payloadData)
            let thisTx = {
              from: "0x"+myAddress,
              to: contract_address,
              value: transValue,
              data: txPayloadData,
              nonce: nonceHex,
              gasPrice: gasPriceHex,
              gasLimit: gasLimitHex,
            }
            let signedTx = new ethTx(thisTx)
            signedTx.sign(myPrivateKey)
            let serializedTx = signedTx.serialize()
            web3.eth.sendSignedTransaction("0x" + serializedTx.toString('hex'), function(err,hash){
              if(err){
                console.log(err);
                callback("gp:"+gasPrice, myPublicKey)
              }else {
                console.log(hash)
                callback("rawTx -> 0x" + serializedTx.toString('hex'))
              }
            })
          })
        }
      })
    })
  })
*/
}

const addDepositBalances = (callback) => {
  let disberse_abi = contract.abi;
  let owner_address = contract.owner_address;
  let contract_address = contract.contract_address;
  let Disberse = new web3.eth.Contract(disberse_abi, contract_address);

  PeerId.createFromPrivKey(directorId.privKey, (err, id) => {
    const myPrivateKey = Buffer.from(id.toHexString().substr(4), 'hex')
    const myPublicKey = ethUtil.privateToAddress(myPrivateKey).toString('hex')
    const myAddress = ethUtil.privateToAddress(myPrivateKey).toString('hex')

    const myWallet = ethWallet.fromPrivateKey(myPrivateKey)
/*
    console.log(myWallet.getAddress())
    console.log(myWallet.getV3Filename())
    console.log(myWallet.toV3String('123'))
*/
//    console.log(myWallet)

//    callback("myPrivateKey: " + myPrivateKey.toString('hex')) 

    web3.eth.getGasPrice(function(err, gasPrice) {
      if(err)
        console.log(err)
    
      let gasPriceHex = web3.utils.toHex(gasPrice)
      let gasLimitHex = web3.utils.toHex(2000000)

      let amount = 1
      let type_id = 1
      let project_ref = "project ref"
      
       
      Disberse.methods.deposit(amount,web3.utils.fromAscii(project_ref),type_id).estimateGas(function(error, gasAmount){
        if(error)
          console.log(error)
        else {
          web3.eth.getTransactionCount("0x"+myAddress, function(err,nonce) {
            if(err)
              console.log(err)

            let nonceHex = web3.utils.toHex(nonce)
            let transValue = web3.utils.toHex(0)

            let lodash = require('lodash')
            let this_function_abi = lodash.find(contract.abi, { name: 'deposit' })
            let payloadData = [amount,web3.utils.fromAscii(project_ref),type_id]
            let txPayloadData = web3.eth.abi.encodeFunctionCall(this_function_abi, payloadData)
console.log(this_function_abi)
            let thisTx = {
              from: "0x"+myAddress,
              to: contract_address,
              value: transValue,
              data: txPayloadData,
              nonce: nonceHex,
              gasPrice: gasPriceHex,
              gasLimit: gasLimitHex,
            }
            let signedTx = new ethTx(thisTx)
            signedTx.sign(myPrivateKey)
            let serializedTx = signedTx.serialize()

/*
            web3.eth.sendSignedTransaction("0x" + serializedTx.toString('hex'), function(err,hash){
              if(err){
                console.log(err);
                callback("gp:"+gasPrice, myPublicKey)
              }else {
*/
                console.log("gasAmount: " + gasAmount)
                console.log("nonce: " + nonce)
                console.log("transValue: " + transValue)
//                console.log(hash)
                callback("gp:"+gasPrice, myPublicKey)
//              }
//            })
          })
        }
      })
    })
  })
}

const listenForTxs = (node) => { 
  node.pubsub.subscribe('disberse/txs',(msg) => {
    console.log("---------TXS-------------------\n", msg.from, msg.data.toString())
    let dataIn = msg.data.toString().split('::')
    let vrs = dataIn[dataIn.length-1].split(',')
    let data = dataIn[dataIn.length-2]
//    console.log(dataIn)
//    console.log(vrs)
    let messageSigner = dataIn[1] 
    let pubkey = ethUtil.ecrecover(
      Buffer.from(data,'hex'), 
      Number(vrs[0]), 
      Buffer.from(vrs[1],'hex'), 
      Buffer.from(vrs[2],'hex')
    )
//    console.log("pubkey: " + pubkey.toString('hex'))
    console.log("messageSignerAddr: " + messageSigner)
    console.log("signerAddr:        " + "0x" + ethUtil.publicToAddress(pubkey).toString('hex'))

    if(messageSigner === "0x" + ethUtil.publicToAddress(pubkey).toString('hex')) {
      console.log("Singnature is VALID")
      console.log("get balance web3 " + dataIn[3])


      if(dataIn[2] == 'newProject') {
        console.log('newProject')
      } else if(dataIn[2] == 'balanceForType') {
        console.log('balanceForType')

        let balances = []
        let balanceAddr = dataIn[3]

//        balances = getAllBalances()
        getContractBalances(msg, balanceAddr, console.log)

        console.log("Balances for " + balanceAddr + " are " + balances)

      } else if(dataIn[2] == 'balance') {
        let balanceAddr = dataIn[3]
        web3.eth.getBalance(balanceAddr, function(err, balance) {
          if(err)
            console.log(err)
          else
          {
            console.log("Balance for " + balanceAddr + " is " + balance)
//            msg.from
//            console.log()
            
//console.log(directorId)
//console.log(directorIdKey.exportKey())
//console.log(directorIdKey.exportKey('public'))


            PeerId.createFromPrivKey(directorId.privKey, (err, id) => {

              const myPrivateKey = Buffer.from(id.toHexString().substr(4), 'hex')
              const myPublicKey = ethUtil.privateToAddress(myPrivateKey).toString('hex')
              const cmdData = `signer::${myPublicKey}::address::${balanceAddr}::balance::${balance}`
              const data = ethUtil.sha3(cmdData)
              const vrs = ethUtil.ecsign(data, myPrivateKey)
            
              console.log(cmdData)
              console.log(data,vrs)

              let sendToPeerId = PeerId.createFromB58String(msg.from)
              console.log("id: " + sendToPeerId)
              PeerInfo.create(sendToPeerId, (err, sendToPeerInfo) => {

                node.dialProtocol(sendToPeerInfo, '/disberse/txReturn', (err, conn) => {
                  if(err) console.log(err)
   
                  const message = (
                    cmdData +
                    "::" +
                    data.toString('hex') +
                    "::" +
                    vrs.v +
                    "," +
                    vrs.r.toString('hex') +
                    "," +
                    vrs.s.toString('hex')
                  )

                  console.log("sending tx return")
                  pull(
                    pull.values([message]),
                    conn
                  )
                })
              })
            })
          }
        })
      }
    } else
      console.log("Singnature is INVALID")
/*
    pubkey = ethJSUtil.ecrecover(data, vrs.v, vrs.r, vrs.s)
    console.log("incomming disberse/txs", "::" ,msg.from, "::", msg.data.toString())
*/
  },(err) => {
    console.log("Listening on pubsub disberse/txs")
//    require('./wsProxy.js')
  })

  web3.eth.net.isListening(function(err,out){ 
    if(err)
      console.log(err)
    else
      console.log('Connected to web3 testnet')
  })
}

PeerInfo.create(directorId, (err, peerInfo) => {
  peerInfo.multiaddrs.add('/dns4/eh1-15.eh7.co.uk/tcp/9998/wss')
  peerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/9999/ws')
  peerInfo.multiaddrs.add('/ip4/127.0.0.1/tcp/9999/ws')
  node = new MyBundle({
    peerInfo
  })

  node.on('peer:disconnect', (peer) => {
    console.log("disconnect from " + peer.id.toB58String())
    
    console.log("cleer peerMap for " + peer.id.toB58String())
    for(var i=0;i<peerMap.length;i++) {
      if(peerMap[i].substr(0,46) === peer.id.toB58String()) {
        console.log("pm: " + peer.id.toB58String() + " " + peerMap[i].substr(0,46))
        delete peerMap[i]
      }
    }
    peerMap = peerMap.filter(function (el) {
      return el != null;
    })
//    peerMap.
//    peerCheck[data.toString('utf8')] = true
  })

  node.on('peer:discovery', (peer) => {
    console.log("discoverd from " + peer.id.toB58String())
  })

  node.on('peer:connect', (peer) => {
    console.log("connection from " + peer.id.toB58String())
  })


  node.handle('/peerMap', (protocol, conn) => {
//console.log(conn)
//    conn.on('error', (err) => {console.log(err)})
    console.log("/peerMap Send latest peerMap to dialer")
    console.log(peerMap)
    console.log("MaxListeners: " + process.getMaxListeners())
    console.log("EventNames: " + process.eventNames())
//    console.log("ConnListeners: " + process.listeners('peer:connect'))
    pull(
      pull.values(peerMap),
      conn
    )
  })

  node.handle('/register', (protocol, conn) => {
//    conn.on('error', (err) => {console.log(err)})
    pull(
      conn,
      pull.map((data) => {
        let message = data.toString('utf8').replace(/\n$/,"")
        if(!peerCheck[data.toString('utf8')]) {
          console.log("added peer to peerMap")
          peerCheck[data.toString('utf8')] = true
          peerMap.push(data.toString('utf8'))
        }
        console.log(data.toString('utf8'))
        console.log(peerMap)
        console.log("sendPeerMap")
      }),
      Catch(),
      pull.drain(()=>{})
    )

/*
    node.dialProtocol(peerInfo, '/sendPeerMap', (err, conn) => {
      console.log("sendingPeerMap")
      pull(
        pull.values(["peerMap"]),
        conn
      )
    })
*/

  })

  node.handle('/disberse/sendtx', (protocol, conn) => {
    console.log('handle /disberse/sendtx')
    pull(
      conn,
      pull.asyncMap((data, callback) => {
        web3.eth.sendSignedTransaction("0x" + data.toString(), function(err,hash){
          if(err){
            console.log("hash err: " + err);
            callback(err,hash)
          }else {
            console.log("hash: " + hash)
            callback(null,hash)
          }
        })
      }),
      conn
    )
  })

  node.handle('/disberse/deposit', (protocol, conn) => {
    console.log('handle /disberse/deposit')
    pull(
      conn,
      pull.asyncMap((data, callback) => {
        web3.eth.sendSignedTransaction("0x" + data.toString(), function(err,hash){
          if(err){
            console.log("hash err: " + err);
            callback(err,hash)
          }else {
            console.log("hash: " + hash)
            callback(null,hash)
          }
        })
      }),
      conn
    )
/*
    pull(
      conn,
      pull.map((data) => {
        console.log(data.toString())
        web3.eth.sendSignedTransaction("0x" + data.toString(), function(err,hash){
          if(err){
            console.log(err);
          }else {
            console.log(hash)
          }
          console.log("hash: " + hash)
        })
//        web3.eth.sendSignedTransaction('0x' + data.toString(),(hash) => {
//          console.log("hash: " + hash)
//        })
      }),
      pull.drain(()=>{})
    )
*/
  })

  node.handle('/disberse/gasnnonce', (protocol, conn) => {
    console.log("/disberse/gasnnonce")
    pull(
      conn,
/*
      pull.map((data) => {
        return data.toString()
//        return data.toString().toUpperCase() + '!!!'
      }),
*/
      pull.asyncMap((data, callback) => {
        web3.eth.getGasPrice(function(err, gasPrice) {
          web3.eth.getTransactionCount(data.toString(), function(err,nonce) {
            callback(null,data.toString()+"::"+gasPrice+"::"+nonce)
          })
        })
      }),
      conn
    )
  })

  node.handle('/message', (protocol, conn) => {
//    conn.on('error', (err) => {console.log(err)})
    pull(
      conn,
      pull.map((data) => {
        let message = data.toString('utf8').replace(/\n$/,"")
        console.log(data.toString('utf8'))
/*
        var string = new TextDecoder("utf-8").decode(data)
        conn.getPeerInfo((err, peerInfo) => {
          const idStr = peerInfo.id.toB58String()
          console.log(idStr + ":: " + string)
        })
*/
      }),
      Catch(),
      pull.drain(()=>{})
    )
  })

  node.start((err)=>{
    if(err) console.log(err)
    console.log("Bootstraper started -> " + node.peerInfo.id.toB58String())
    console.log("Thanks wsProxy.js multiaddr")
    console.log("multiaddr -> " + "/dns4/demo.disberse.com/tcp/9997/wss/ipfs/" + node.peerInfo.id.toB58String())
    node.peerInfo.multiaddrs.forEach((ma) => {
      console.log("multiaddr -> " + ma.toString())
    })
    listenForTxs(node)
  })

})

/*
parallel([
  (cb) => createNode(cb)
], (err, nodes) => {
  if (err) { throw err }

  const directorNode = nodes[0]

  directorNode.on('peer:connect', (peerInfo) => {
    console.log("Connect to " + peerInfo.id.toB58String())

    directorNode.dialProtocol(peerInfo, '/disberse/peer/0.0.0', (err, conn) => {

      var message = "ack connect from " + directorNode.peerInfo.id.toB58String();

      console.log("Send ack request to peer")
      pull(
        pull.values([message]),
        conn
      )
    })

  })

  directorNode.handle('/director/register', (protocol, conn) => {
    console.log("/director/register")
    pull(
      conn,
      pull.map((v) => v.toString()),
      pull.log()
    )
  })


//  console.log(directorNode.peerInfo.id.toB58String())
  directorNode.peerInfo.multiaddrs.forEach((ma) => {
    console.log(ma.toString('utf8'))
  })
}
*/
