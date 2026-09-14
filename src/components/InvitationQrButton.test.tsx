import {expect,test,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {CloudStore} from '../data/CloudStore';
import {InvitationQrButton} from './InvitationQrButton';
import {groupInvitationUrl,invitationQrImage} from '../utils/groupInvitation';
vi.mock('../utils/groupInvitation',()=>({groupInvitationUrl:vi.fn(),invitationQrImage:vi.fn()}));
afterEach(()=>vi.resetAllMocks());
const store=new CloudStore('a'.repeat(64));store.group={id:'example',name:'テスト会',role:'participant'};
test('opens a dialog with a downloadable QR and closes without leaving the image visible',async()=>{
 vi.mocked(groupInvitationUrl).mockResolvedValue('https://example.test/#/join/abc');vi.mocked(invitationQrImage).mockResolvedValue('data:image/png;base64,test');
 render(<InvitationQrButton store={store}/>);fireEvent.click(screen.getByRole('button',{name:'QRコード'}));
 const image=await screen.findByAltText('テスト会の招待用QRコード');expect(image.getAttribute('src')).toBe('data:image/png;base64,test');
 expect(screen.getByRole('link',{name:'画像を保存'}).getAttribute('download')).toBe('janroku-invitation-qr.png');
 fireEvent.click(screen.getByRole('button',{name:'QRコードを閉じる'}));expect(screen.queryByRole('dialog')).toBeNull();
});
test('failed invitation lookup shows retry instead of an unverified QR code',async()=>{
 vi.mocked(groupInvitationUrl).mockRejectedValueOnce(new Error('招待リンクを取得できませんでした。')).mockResolvedValue('https://example.test/#/join/abc');vi.mocked(invitationQrImage).mockResolvedValue('data:image/png;base64,test');
 render(<InvitationQrButton store={store}/>);fireEvent.click(screen.getByRole('button',{name:'QRコード'}));await screen.findByRole('alert');expect(invitationQrImage).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'再試行'}));await waitFor(()=>expect(screen.getByAltText('テスト会の招待用QRコード')).toBeTruthy());
});
