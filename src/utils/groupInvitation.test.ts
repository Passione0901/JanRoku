// @vitest-environment node
import {afterEach,expect,test,vi} from 'vitest';
import jsQR from 'jsqr';
import {PNG} from 'pngjs';
import {CloudStore} from '../data/CloudStore';
import {groupInvitationUrl,invitationQrImage} from './groupInvitation';
afterEach(()=>vi.unstubAllGlobals());
// Updated 2026-09-14: Decode the generated PNG independently, including the secret fragment, instead of comparing a mock encoder call.
test('PNG decodes to the full group invitation URL',async()=>{
 const url='https://jang-roku.pages.dev/#/join/'+'a1'.repeat(32);
 const image=await invitationQrImage(url);const png=PNG.sync.read(Buffer.from(image.split(',')[1],'base64'));
 expect(jsQR(new Uint8ClampedArray(png.data),png.width,png.height)?.data).toBe(url);
});
test('admin sharing resolves a participant key and never encodes the admin key',async()=>{
 vi.stubGlobal('location',{origin:'https://jang-roku.pages.dev',pathname:'/'});
 const admin='a'.repeat(64),participant='b'.repeat(64);const store=new CloudStore(admin);store.group={id:'group-1',name:'Test',role:'admin'};
 const fetcher=vi.fn(async()=>Response.json({token:participant}));vi.stubGlobal('fetch',fetcher);
 expect(await groupInvitationUrl(store)).toBe('https://jang-roku.pages.dev/#/join/'+participant);
 fetcher.mockImplementation(async()=>Response.json({token:admin}));await expect(groupInvitationUrl(store)).rejects.toThrow('参加者用');
 fetcher.mockImplementation(async()=>Response.json({error:'無効なURL'},{status:401}));await expect(groupInvitationUrl(store)).rejects.toThrow('無効なURL');
});
test('participant sharing needs no external QR or invitation service',async()=>{
 vi.stubGlobal('location',{origin:'https://jang-roku.com',pathname:'/'});const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 expect(await groupInvitationUrl(new CloudStore('c'.repeat(64)))).toBe('https://jang-roku.com/#/join/'+'c'.repeat(64));expect(fetcher).not.toHaveBeenCalled();
});
