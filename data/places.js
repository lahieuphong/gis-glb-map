// GeoJSON dùng chuẩn tọa độ [longitude, latitude].
// Khi có GLB thật, hãy đặt file vào public/models rồi đổi modelUrl tương ứng.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const publicAsset = (path) => `${basePath}${path}`;

export const placesGeojson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'demo-1',
        name: 'Điểm trải nghiệm 3D số 1',
        description: 'Click điểm này để mở một mô hình công trình GLB mẫu.',
        modelUrl: publicAsset('/models/demo-building.glb'),
        category: 'Công trình'
      },
      geometry: {
        type: 'Point',
        coordinates: [106.6953, 10.7769]
      }
    },
    {
      type: 'Feature',
      properties: {
        id: 'demo-2',
        name: 'Điểm trải nghiệm 3D số 2',
        description: 'Mẫu này đại diện cho kiosk/booth/nhà trưng bày nhỏ.',
        modelUrl: publicAsset('/models/demo-pavilion.glb'),
        category: 'Trưng bày'
      },
      geometry: {
        type: 'Point',
        coordinates: [106.7009, 10.7757]
      }
    },
    {
      type: 'Feature',
      properties: {
        id: 'demo-3',
        name: 'Điểm trải nghiệm 3D số 3',
        description: 'Mẫu này đại diện cho tượng đài/cột mốc/hiện vật ngoài trời.',
        modelUrl: publicAsset('/models/demo-monument.glb'),
        category: 'Hiện vật'
      },
      geometry: {
        type: 'Point',
        coordinates: [106.6882, 10.7826]
      }
    },
    {
      type: 'Feature',
      properties: {
        id: 'demo-4',
        name: 'Nhà cổ Tràng An - Ninh Bình',
        description: 'Không gian nhà gỗ truyền thống trong vùng lõi Di sản thế giới Tràng An, gắn với các làng cổ Trường Yên, Hoa Lư. Nhiều nếp nhà còn giữ kiến trúc Bắc Bộ như mái ngói, cột gỗ, tảng đá kê chân cột và hoa văn chạm khắc trên vì kèo, ngưỡng cửa.',
        modelUrl: publicAsset('/models/01-Nha-co-Trang-An-Ninh-Binh.glb'),
        category: 'Nhà cổ'
      },
      geometry: {
        type: 'Point',
        coordinates: [105.905369, 20.2783]
      }
    }
  ]
};
