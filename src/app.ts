import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { Scraper } from "./scraper"

export class App {
  public static manga: Scraper
  public static window: BrowserWindow

  public static async createWindow(): Promise<void> {
    await app.whenReady()

    console.info('[App] Starting application window')
    this.window = new BrowserWindow({
      width: 1280,
      height: 720,
      title: 'FunFox',
      icon: path.join(process.cwd(), 'assets', 'img', 'icon.ico'),
      webPreferences: {
        preload: path.join(process.cwd(), 'assets', 'js', 'preload.js')
      }
    })

    console.info('[App] Loading Index.html')
    await this.window.loadFile('../assets/index.html')
    console.info('[App] index.html loaded')

    app.on('window-all-closed', () => {
      this.quit()
    })

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await this.createWindow()
      }
    })
  }

  private static quit(): void {
    if (process.platform !== 'darwin') {
      console.info('[App] Exiting application')
      app.quit()
    }
  }

  public static async run(): Promise<void> {
    ipcMain.on('setManga', async (event: Electron.IpcMainEvent, mangaName: string, startChapter: number, savePath: string) => {
      this.manga = new Scraper(mangaName.replace(/\s/gm, '_').replace(/\W/gm, '').toLowerCase(), startChapter, savePath)

      if (!(await this.manga.mangaExists())) {
        event.sender.send('error')
        return
      }

      console.info('[App] Loading download.html')
      await this.window.loadFile('../assets/download.html')
      console.info('[App] download.html loaded')
    })

    ipcMain.on('back', async () => {
      await this.window.loadFile('../assets/index.html')
    })

    ipcMain.on('startDownload', async (event: Electron.IpcMainEvent) => {
      await this.startDownload(event)
    })

    ipcMain.on('closeWindow', () => {
      this.quit()
    })
  }

  public static async startDownload(event: Electron.IpcMainEvent): Promise<void> {
    console.info('[App] Starting Scrapper')
    await Scraper.startBrowser()
    await this.manga.setChaptersQuantity()

    const chaptersQuantity = (this.manga.chaptersQuantity - this.manga.startChapter) + 1

    console.info('[App] Setting chapters quantity')
    event.sender.send('progress', 'chapters', 'setQuantity', chaptersQuantity)

    while (this.manga.chaptersCount < 100) {
      await this.manga.setPagesQuantity()

      console.info('[App] Setting pages quantity')
      event.sender.send('progress', 'pages', 'setQuantity', this.manga.pagesQuantity)

      while (true) {
        await this.manga.download()

        console.info('[App] Setting pages progress')
        event.sender.send('progress', 'pages', 'setProgress', this.manga.pageNumber)

        if (this.manga.lastPage) break
        this.manga.nextPage()
      }

      console.info('[App] Setting chapters progress')
      event.sender.send('progress', 'chapters', 'setProgress', ++this.manga.chaptersCount)

      if (this.manga.lastChapter()) break
      await this.manga.nextChapter()
    }

    console.info('[App] Closing browser')
    await Scraper.closeBrowser()

    event.sender.send('hideProgress')
  }
}