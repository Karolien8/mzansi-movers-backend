FirebaseAppError: Failed to parse private key: Error: Invalid PEM formatted message.
    at new ServiceAccount (/var/task/node_modules/firebase-admin/lib/app/credential-internal.js:153:19)
    at new ServiceAccountCredential (/var/task/node_modules/firebase-admin/lib/app/credential-internal.js:70:15)
    at Object.cert (/var/task/node_modules/firebase-admin/lib/app/credential-factory.js:103:54)
    at Object.<anonymous> (/var/task/api/_firebase.js:15:35)
    at Module.<anonymous> (/opt/rust/bytecode.js:2:1468)
    at L.m._compile (/opt/rust/bytecode.js:2:4882)
    at Object..js (node:internal/modules/cjs/loader:2060:10)
    at Module.load (node:internal/modules/cjs/loader:1651:32)
    at Module.<anonymous> (node:internal/modules/cjs/loader:1443:12)
    at /opt/rust/nodejs.js:2:15014 {
errorInfo: {…},
codePrefix: "app"
}
Node.js process exited with exit status: 1. The logs above can help with debugging the issue.
