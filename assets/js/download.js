const ipcRenderer = window.electron.IpcRenderer

window.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('button[name="startDownload"]')
    button.addEventListener('click', async () => {
        button.classList.add('is-hidden')
        document.querySelector('.progress-bars').classList.remove('is-hidden')
        ipcRenderer.send('startDownload')
    })
    document.querySelector('button[name="closeWindow"]').addEventListener('click', () => {
        ipcRenderer.send('closeWindow')
    })
})

ipcRenderer.on('progress', (e, type, event, value) => {
    const progressbar = document.querySelector(`progress[name="${type}"]`)

    switch (event) {
        case 'setQuantity':
            progressbar.max = value
            return
        case 'setProgress':
            progressbar.value = value
            progressbar.textContent = `${(progressbar.value * 100) / progressbar.max}%`
            return
    }
})

ipcRenderer.on('hideProgress', () => {
    document.querySelector('.progress-bars').classList.add('is-hidden')
    document.querySelector('.message-header p').textContent = `Downloading the manga ends.`
    document.querySelector('button[name="closeWindow"]').classList.remove('is-hidden')
})