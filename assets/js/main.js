const ipcRenderer = window.electron.IpcRenderer

window.addEventListener('DOMContentLoaded', () => {
    document.querySelector('button[name="submit"]').addEventListener('click', () => {
        const mangaName = document.querySelector('input[name="mangaName"]').value
        const startChapter = parseFloat(document.querySelector('input[name="startChapter"]').value)
        const savePath = document.querySelector('input[name="savePath"]').value

        ipcRenderer.send('setManga', mangaName, startChapter, savePath)
    })

    document.querySelector('button[name="back"]').addEventListener('click', async () => {
        ipcRenderer.send('back')
    })
})

ipcRenderer.on('error', () => {
    document.querySelector('.form').classList.add('is-hidden')
    document.querySelector('.error').classList.remove('is-hidden')
    document.querySelector('button[name="back"]').classList.remove('is-hidden')
})