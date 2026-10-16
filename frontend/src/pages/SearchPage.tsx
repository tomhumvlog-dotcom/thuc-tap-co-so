import { Check, Search, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';
import { Avatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';
import { Empty, ErrorState, Loading } from '../components/States';
import type { Page, Post, User } from '../types';

export function SearchPage() {
  const { user: currentUser } = useAuth();
  const [q, setQ] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [tab, setTab] = useState<'users' | 'posts'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [followingBusy, setFollowingBusy] = useState<string[]>([]);
  const [error, setError] = useState('');

  const loadExplore = useCallback(async () => {
    setLoading(true); setError('');
    const [peopleResult, postsResult] = await Promise.allSettled([
      api<Page<User>>('/users/suggestions?limit=8'),
      api<Page<Post>>('/posts?limit=8'),
    ]);
    if (peopleResult.status === 'fulfilled') setSuggestions(peopleResult.value.items);
    if (postsResult.status === 'fulfilled') setFeaturedPosts(postsResult.value.items);
    if (peopleResult.status === 'rejected' && postsResult.status === 'rejected') {
      setError((peopleResult.reason as Error).message || 'Không tải được nội dung khám phá.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadExplore(); }, [loadExplore]);

  const search = async (event?: FormEvent, nextTab = tab, value = q) => {
    event?.preventDefault();
    const query = value.trim();
    if (!query) { setActiveQuery(''); return; }
    setBusy(true); setError(''); setActiveQuery(query); setTab(nextTab);
    if (nextTab === 'users') setUsers([]); else setPosts([]);
    try {
      if (nextTab === 'users') setUsers((await api<Page<User>>(`/search/users?q=${encodeURIComponent(query)}`)).items);
      else setPosts((await api<Page<Post>>(`/search/posts?q=${encodeURIComponent(query)}`)).items);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  };

  const toggleFollow = async (person: User) => {
    if (followingBusy.includes(person.id)) return;
    setFollowingBusy((ids) => [...ids, person.id]);
    try {
      await api(`/users/${person.id}/follow`, { method: person.is_following ? 'DELETE' : 'POST' });
      const update = (entry: User) => entry.id === person.id ? {
        ...entry,
        is_following: !person.is_following,
        followers_count: Math.max(0, entry.followers_count + (person.is_following ? -1 : 1)),
      } : entry;
      setSuggestions((items) => items.map(update));
      setUsers((items) => items.map(update));
    } catch (reason) { setError((reason as Error).message); }
    finally { setFollowingBusy((ids) => ids.filter((id) => id !== person.id)); }
  };

  const userRows = (items: User[]) => <div className="user-results">{items.map((person) => <div className="user-row surface" key={person.id}>
    <Link to={`/${person.username}`}><Avatar user={person} /><div><b>{person.display_name}</b><span>@{person.username}</span><small>{person.followers_count} người theo dõi</small></div></Link>
    {person.id !== currentUser?.id && <button className={person.is_following ? 'secondary-btn following-btn' : 'secondary-btn'} disabled={followingBusy.includes(person.id)} onClick={() => toggleFollow(person)}>{person.is_following ? <Check size={16} /> : <UserPlus size={16} />}{person.is_following ? 'Đang theo dõi' : 'Theo dõi'}</button>}
  </div>)}</div>;

  return <>
    <div className="page-header">
      <p className="eyebrow">KHÁM PHÁ CỘNG ĐỒNG</p><h1>Khám phá</h1>
      <form className="search-box" onSubmit={(event) => search(event)}><Search /><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tìm người hoặc nội dung..." /><kbd>↵</kbd></form>
      {activeQuery && <div className="profile-tabs"><button className={tab === 'users' ? 'active' : ''} onClick={() => search(undefined, 'users')}>Mọi người</button><button className={tab === 'posts' ? 'active' : ''} onClick={() => search(undefined, 'posts')}>Bài viết</button></div>}
    </div>
    {error && <ErrorState message={error} retry={() => activeQuery ? search(undefined) : loadExplore()} />}
    {loading || busy ? <Loading /> : activeQuery ? tab === 'users'
      ? users.length ? userRows(users) : <Empty title="Chưa tìm thấy người dùng" text={`Không có kết quả cho “${activeQuery}”.`} />
      : posts.length ? <div className="post-list">{posts.map((post) => <PostCard key={post.id} initial={post} />)}</div> : <Empty title="Chưa tìm thấy bài viết" text={`Không có kết quả cho “${activeQuery}”.`} />
      : <div className="discover-content">
        <section className="discover-section"><div className="discover-section-heading"><div><p className="eyebrow">GẶP GỠ THÀNH VIÊN</p><h2>Người bạn có thể quan tâm</h2></div></div>
          {suggestions.length ? userRows(suggestions) : <Empty title="Bạn đã theo dõi mọi người rồi" text="Thử tìm kiếm để khám phá thêm thành viên." />}
        </section>
        <section className="discover-section"><div className="discover-section-heading"><div><p className="eyebrow">NỘI DUNG CỘNG ĐỒNG</p><h2>Bài viết nổi bật</h2></div></div>
          {featuredPosts.length ? <div className="post-list">{featuredPosts.map((post) => <PostCard key={post.id} initial={post} />)}</div> : <Empty title="Chưa có bài viết" text="Bài viết mới sẽ xuất hiện tại đây." />}
        </section>
      </div>}
  </>;
}
