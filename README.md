<div align="center">
  <h1> TransferIT Downloader</h1>
  <p><strong>Bulk download manager for transfer.it links</strong></p>

  <!-- Badges -->
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg?cacheSeconds=2592000" alt="Version" />
  <img src="https://img.shields.io/badge/Electron-36.0.0-47848F.svg?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/Node.js-Backend-339933.svg?logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" />
</div>

<p align="center">
  <a href="#vietnamese-version">🇻🇳 Tiếng Việt</a> | <a href="#english-version">🇬🇧 English</a>
</p>

---

<a id="vietnamese-version"></a>
# 🇻🇳 Tiếng Việt

## Introduction

**TransferIT Downloader** là một ứng dụng Desktop mạnh mẽ, đóng vai trò là một trình quản lý tải xuống hàng loạt (Bulk download manager) chuyên dụng cho các liên kết chia sẻ từ transfer.it (hoặc MEGA). Ứng dụng tự động nhận diện, phân tích cấu trúc liên kết và thực hiện tải về hàng loạt các tệp tin một cách tối ưu, giúp doanh nghiệp và người dùng cá nhân tiết kiệm thời gian đáng kể trong việc xử lý luồng dữ liệu lớn.

##  Giao diện ứng dụng (Screenshots)


<div align="center">
  <img src="<img width="1592" height="1008" alt="image" src="https://github.com/user-attachments/assets/30217f3e-c36f-41c6-9d3e-58fb0e1b084f" />
" alt="Main Interface" width="800"/>
  <p><em>Giao diện chính của ứng dụng - Quản lý link tải và thống kê bằng Chart.js</em></p>
</div>

## Key Features

- **Tải xuống hàng loạt (Bulk Download):** Tự động phân tích và trích xuất tệp từ hàng loạt link transfer.it / MEGA.
- **Quản lý hàng đợi thông minh:** Tích hợp logic xử lý hàng đợi giúp giới hạn số lượng tác vụ tải đồng thời, chống quá tải mạng và phần cứng.
- **Phân tích dữ liệu & Báo cáo:** Hiển thị biểu đồ, thống kê tốc độ và trạng thái tiến trình tải theo thời gian thực.
- **Giao diện trực quan:** Trải nghiệm người dùng mượt mà với UI tối ưu trên nền tảng Desktop.
- **Hoạt động đa luồng:** Phân tách rõ ràng giữa Main process và Renderer process để đảm bảo hiệu suất.

## Tech Stack

- **Frontend:** HTML/CSS/JavaScript thuần, **Chart.js**
- **Backend / Core (Node.js & Electron):** **Electron (v36)**, **megajs** (giao tiếp giao thức MEGA), **p-queue**
- **Infrastructure / DevOps:** **electron-builder**

## Architecture / Project Structure

Dự án áp dụng mô hình chuẩn của Electron với sự phân chia rõ ràng giữa Main Process và Renderer Process:

```text
transfer/
├── main.js                # Main Process: Quản lý vòng đời ứng dụng, giao tiếp OS
├── preload.js             # Context Bridge: Cầu nối bảo mật Main - Renderer
├── renderer/              # Renderer Process: Chứa toàn bộ giao diện UI
│   ├── index.html         # Giao diện chính của ứng dụng
│   └── scripts/           # Logic phía giao diện (ui-links.js, v.v)
├── src/                   # Core Logic: downloader.js, utils.js
├── dist/                  # Thư mục build installer
└── package.json           # Quản lý dependencies
```



## Getting Started

```bash
git clone https://github.com/honangquy/mega-downloader.git
cd transfer
npm install
npm run dev # Chạy ở chế độ Development
npm start   # Chạy thông thường
```

## Environment Variables

Tạo file `.env` nếu cần thiết để quản lý các biến cấu hình (vd: `MAX_CONCURRENT_DOWNLOADS=3`, `DEBUG_MODE=false`).

## Testing & Deployment

- **Test:** `npm test` *(Đang cấu hình)*
- **Build Production:** `npm run build` (Sẽ tạo ra file `.exe` bằng thư viện `electron-builder` ở thư mục `dist/`).

## Contributing & License

- **Giấy phép:** Phân phối dưới giấy phép [MIT](https://choosealicense.com/licenses/mit/).
- **Tác giả:** honangquy
- **Liên hệ:** hoquy902@gmail.com

---

<a id="english-version"></a>
# 🇬🇧 English Version

## Introduction

**TransferIT Downloader** is a powerful Desktop application acting as a specialized bulk download manager for transfer.it (or MEGA) shared links. The app automatically detects, parses link structures, and optimally downloads multiple files simultaneously, saving significant time for users dealing with large data streams.

##  Screenshots


<div align="center">
  <img src="https://via.placeholder.com/800x450?text=App+Screenshot+1" alt="Main Interface" width="800"/>
  <p><em>Main Application Interface - Manage links and view Chart.js statistics</em></p>
</div>

## Key Features

- **Bulk Download:** Automatically parse and extract files from multiple transfer.it / MEGA links.
- **Smart Queue Management:** Integrated queue logic to limit concurrent download tasks, preventing network and hardware overload.
- **Data Analytics & Reporting:** Real-time display of charts, speed statistics, and download progress.
- **Intuitive Interface:** Smooth user experience with an optimized Desktop UI.
- **Multi-threaded Operations:** Clear separation between the Main process and Renderer process to ensure UI performance.

## Tech Stack

- **Frontend:** Pure HTML/CSS/JavaScript, **Chart.js**
- **Backend / Core (Node.js & Electron):** **Electron (v36)**, **megajs** (MEGA protocol communication), **p-queue**
- **Infrastructure / DevOps:** **electron-builder**

## Architecture / Project Structure

The project applies the standard Electron architecture with a clear separation of concerns:

```text
transfer/
├── main.js                # Main Process: App lifecycle & OS integrations
├── preload.js             # Context Bridge: Secure IPC bridge
├── renderer/              # Renderer Process: User Interface (HTML/CSS/JS)
│   ├── index.html         # Main UI
│   └── scripts/           # Frontend logic (e.g. ui-links.js)
├── src/                   # Core Logic: downloader.js, utils.js
├── dist/                  # Installer build output
└── package.json           # Dependencies and scripts
```


## Getting Started

```bash
git clone https://github.com/honangquy/mega-downloader.git
cd transfer
npm install
npm run dev # Run in Development mode
npm start   # Normal start
```

## Environment Variables

Create an `.env` file if necessary to manage environment configurations (e.g., `MAX_CONCURRENT_DOWNLOADS=3`, `DEBUG_MODE=false`).

## Testing & Deployment

- **Test:** `npm test` *(WIP)*
- **Build Production:** `npm run build` (This generates a standalone `.exe` installer via `electron-builder` in the `dist/` folder).

## Contributing & License

- **License:** Distributed under the [MIT License](https://choosealicense.com/licenses/mit/).
- **Author:** honangquy
- **Contact:** hoquy902@gmail.com
