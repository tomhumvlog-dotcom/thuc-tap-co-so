import { Bell, Bookmark, CheckCheck, Heart, MessageCircle, Repeat2, Trash2, UserPlus, FileText } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';
import { Avatar } from '../components/Avatar';
import { Empty, ErrorState, Loading } from '../components/States';
import type { Notification, Page, Post } from '../types';

const icons = { post: FileText, like: Heart, reply: MessageCircle, follow: UserPlus, repost: Repeat2, bookmark: Bookmark, moderation: Bell };

export function ActivityPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [showingSamples, setShowingSamples] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (offset = 0) => {
    setLoading(true); setError('');
    try {
      const data = await api<{ items: Notification[]; unread_count: number; offset: number; limit: number }>(`/notifications?offset=${offset}&limit=20`);
      if (!offset && !data.items.length) {
        const posts = await api<Page<Post>>('/posts?limit=8');
        const sampleTypes = ['like', 'reply', 'repost', 'follow'];
        const sampleMessages = [
          (name: string) => `${name} đã thích một bài viết trong cộng đồng.`,
          (name: string) => `${name} đã trả lời một thread gần đây.`,
          (name: string) => `${name} đã chia sẻ lại một bài viết.`,
          (name: string) => `${name} vừa tham gia cộng đồng KMA Threads.`,
        ];
        const samples = posts.items.filter((post) => post.author.id !== user?.id).slice(0, 4).map((post, index) => {
          const type = sampleTypes[index % sampleTypes.length];
          return {
            id: `sample-${post.id}-${index}`,
            actor: post.author,
            type,
            message: sampleMessages[index % sampleMessages.length](post.author.display_name),
            ...((type === 'follow') ? {} : { post_id: post.id }),
            is_read: true,
            created_at: post.created_at,
          } satisfies Notification;
        });
        setItems(samples); setShowingSamples(samples.length > 0);
      } else {
        setItems((current) => offset ? [...current, ...data.items] : data.items);
        setShowingSamples(false);
      }
      setUnread(data.unread_count); setNextOffset(data.offset + data.items.length); setHasMore(data.items.length === data.limit);
    } catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (action: 'all' | 'read' | 'delete', item?: Notification) => {
    if (busy || loading) return;
    if (action === 'delete' && !window.confirm('Xóa thông báo này?')) return;
    setBusy(true); setError('');
    try {
      if (action === 'all') {
        await api('/notifications/read-all', { method: 'PATCH' });
        setItems((current) => current.map((entry) => ({ ...entry, is_read: true }))); setUnread(0);
      } else if (item) {
        if (action === 'read') {
          const updated = await api<Notification>(`/notifications/${item.id}/read`, { method: 'PATCH' });
          setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));
        } else {
          await api(`/notifications/${item.id}`, { method: 'DELETE' });
          setItems((current) => current.filter((entry) => entry.id !== item.id));
          setNextOffset((value) => Math.max(0, value - 1));
        }
        if (!item.is_read) setUnread((count) => Math.max(0, count - 1));
      }
      window.dispatchEvent(new Event('kma:notifications-changed'));
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  };

  return <>
    <div className="page-header row"><div><p className="eyebrow">{showingSamples ? 'HOẠT ĐỘNG MẪU' : 'CẬP NHẬT MỚI NHẤT'}</p><h1>Hoạt động {unread > 0 && <sup>{unread}</sup>}</h1></div>
      {unread > 0 && <button className="text-btn" disabled={busy || loading} onClick={() => act('all')}><CheckCheck /> Đọc tất cả</button>}
    </div>
    {error && <ErrorState message={error} retry={() => load()} />}
    <div className="activity-list">{items.map((item) => {
      const Icon = icons[item.type as keyof typeof icons] || Bell;
      return <article key={item.id} className={`activity-row surface ${item.is_read ? '' : 'unread'}`}>
        <div className="activity-avatar">{item.actor ? <Link to={`/${item.actor.username}`} aria-label={`Trang cá nhân ${item.actor.username}`}><Avatar user={item.actor} /></Link> : <span className="system-avatar">@</span>}<i><Icon /></i></div>
        <div className="activity-copy">{(item.post_id || item.target_user || item.actor) ? <Link className="activity-destination" to={item.post_id ? `/posts/${item.post_id}` : `/${(item.target_user || item.actor)!.username}`}><p>{item.message}</p><span>{new Date(item.created_at).toLocaleString('vi-VN')}</span><small>{item.post_id ? 'Mở bài viết' : 'Mở trang cá nhân'}</small></Link> : <><p>{item.message}</p><span>{new Date(item.created_at).toLocaleString('vi-VN')}</span></>}</div>
        <div className="notification-actions">
          {!showingSamples && !item.is_read && <button className="icon-btn" disabled={busy || loading} onClick={() => act('read', item)} aria-label="Đánh dấu thông báo đã đọc" title="Đánh dấu đã đọc"><CheckCheck /></button>}
          {!showingSamples && <button className="icon-btn danger" disabled={busy || loading} onClick={() => act('delete', item)} aria-label="Xóa thông báo" title="Xóa thông báo"><Trash2 /></button>}
        </div>
        {!item.is_read && <b className="unread-dot" />}
      </article>;
    })}</div>
    {loading ? <Loading /> : !error && !items.length ? <Empty title="Chưa có hoạt động" text="Lượt thích, trả lời và người theo dõi mới sẽ xuất hiện tại đây." /> : null}
    {!loading && hasMore && !error && <button className="secondary-btn load-more" disabled={busy} onClick={() => load(nextOffset)}>Xem thêm</button>}
  </>;
}

