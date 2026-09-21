import { isCachedPhotoUri } from '../src/utils/productImages';

const CACHE = 'file:///data/user/0/app/cache/';

describe('isCachedPhotoUri', () => {
  it('solo considera fotos dentro del directorio de caché de la app', () => {
    expect(isCachedPhotoUri(`${CACHE}image_picker_0.jpg`, CACHE)).toBe(true);
  });

  it('rechaza archivos fuera de la caché', () => {
    expect(isCachedPhotoUri('file:///storage/emulated/0/DCIM/photo.jpg', CACHE)).toBe(false);
  });

  it('rechaza content:// y URLs remotas para no borrarlas', () => {
    expect(isCachedPhotoUri('content://media/external/images/1', CACHE)).toBe(false);
    expect(isCachedPhotoUri('https://example.com/logo.png', CACHE)).toBe(false);
  });

  it('maneja valores nulos y prefijos parciales', () => {
    expect(isCachedPhotoUri(null, CACHE)).toBe(false);
    expect(isCachedPhotoUri(undefined, CACHE)).toBe(false);
    expect(isCachedPhotoUri(`${CACHE}photo.jpg`, undefined)).toBe(false);
    expect(isCachedPhotoUri(`${CACHE}nested/photo.jpg`, `${CACHE}nested`)).toBe(true);
  });
});