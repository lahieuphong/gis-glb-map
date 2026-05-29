# GIS + GLB Map

Ứng dụng Next.js hiển thị các địa điểm GIS trên MapLibre và mở model `.glb` tương ứng trong panel 3D.

## Chạy dự án

```bash
yarn install
yarn dev
```

Mở:

```txt
http://localhost:3000
```

## Dữ liệu địa điểm

Danh sách địa điểm nằm trong `data/places`.

Mỗi địa điểm là một file Markdown có frontmatter:

```md
---
order: 1
id: place-1
name: Nhà cổ Tràng An - Ninh Bình
category: Nhà cổ
model: 35-Ninh-Binh/Nha-co-Trang-An.glb
coordinates: [105.905369, 20.2783]
---
Mô tả địa điểm.
```

Lưu ý: `coordinates` dùng thứ tự `[kinh độ, vĩ độ]`.

## Model GLB

Các file `.glb` đặt trong `public/models`.

Trường `model` trong Markdown trỏ tới đường dẫn bên trong thư mục này, ví dụ:

```md
model: 35-Ninh-Binh/Nha-co-Trang-An.glb
```

## Build

```bash
yarn build
yarn start
```

## Tài liệu

- [Hướng dẫn model GLB](public/models/README.md)
