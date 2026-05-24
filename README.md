# GIS + GLB Map Demo — Next.js + Yarn

Demo này là bản chuyển từ React/Vite sang **Next.js App Router + Yarn**.

Tính năng chính:

- Hiển thị bản đồ GIS bằng MapLibre GL JS.
- Hiển thị các điểm dạng chấm từ GeoJSON.
- Click vào điểm để zoom/fly tới vị trí đó.
- Mở panel bên phải để xem file `.glb` bằng `<model-viewer>`.
- Có sẵn 3 file GLB mẫu trong `public/models` để chạy thử ngay.

## 1. Cài đặt

Yêu cầu khuyến nghị:

- Node.js 20 trở lên.
- Yarn. Nếu máy chưa có Yarn, có thể dùng Corepack đi kèm Node.js mới.

Chạy lệnh:

```bash
corepack enable
cd gis-glb-nextjs-map
yarn install
yarn dev
```

Mở trình duyệt:

```txt
http://localhost:3000
```

## 2. Cấu trúc thư mục

```txt
gis-glb-nextjs-map/
├─ app/
│  ├─ layout.jsx
│  ├─ page.jsx
│  └─ globals.css
├─ components/
│  ├─ GisMap.jsx
│  └─ ModelPanel.jsx
├─ data/
│  └─ places.js
├─ public/
│  └─ models/
│     ├─ demo-building.glb
│     ├─ demo-pavilion.glb
│     └─ demo-monument.glb
├─ next.config.mjs
├─ package.json
└─ README.md
```

## 3. Thay điểm GIS

Mở file:

```txt
data/places.js
```

Mỗi điểm có dạng:

```js
{
  type: 'Feature',
  properties: {
    id: 'demo-1',
    name: 'Điểm trải nghiệm 3D số 1',
    description: 'Click điểm này để mở mô hình GLB.',
    modelUrl: '/models/demo-building.glb',
    category: 'Công trình'
  },
  geometry: {
    type: 'Point',
    coordinates: [106.6953, 10.7769]
  }
}
```

Quan trọng: GeoJSON dùng thứ tự tọa độ:

```txt
[longitude, latitude]
```

Tức là:

```txt
[kinh độ, vĩ độ]
```

## 4. Thay file GLB thật

Copy file GLB vào:

```txt
public/models/
```

Ví dụ:

```txt
public/models/nha-truyen-thong.glb
```

Sau đó đổi trong `data/places.js`:

```js
modelUrl: '/models/nha-truyen-thong.glb'
```

## 5. Những file quan trọng

### `components/GisMap.jsx`

Đây là component bản đồ chính. File này:

- tạo map MapLibre,
- add GeoJSON source,
- add layer chấm,
- bắt sự kiện click vào điểm,
- gọi `map.flyTo`,
- truyền điểm đang chọn sang `ModelPanel`.

### `components/ModelPanel.jsx`

Đây là panel xem model 3D. File này:

- lazy-load `@google/model-viewer` phía client,
- render thẻ `<model-viewer>`,
- nhận `selectedPlace.modelUrl` để hiển thị đúng file GLB.

## 6. Build production

```bash
yarn build
yarn start
```

## 7. Gợi ý nâng cấp tiếp theo

Khi demo chạy ổn, bạn có thể nâng cấp theo thứ tự:

1. Đổi data từ `data/places.js` sang API.
2. Lưu điểm GIS bằng PostgreSQL + PostGIS.
3. Lưu GLB trên Cloudflare R2, Supabase Storage hoặc S3.
4. Thêm clustering khi có nhiều điểm.
5. Nếu muốn mô hình 3D nằm trực tiếp trên bản đồ, nghiên cứu MapLibre custom layer + Three.js hoặc CesiumJS + 3D Tiles.
