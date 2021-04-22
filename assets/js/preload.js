const { contextBridge, ipcRenderer } = require('electron')

console.log('preload')
console.log(ipcRenderer.on)

contextBridge.exposeInMainWorld(
    'electron',
    {
        IpcRenderer: {
            send: (event, ...args) => ipcRenderer.send(event, ...args),
            on: (event, callback) => {
                ipcRenderer.on(event, callback)
            }
        }
    }
)