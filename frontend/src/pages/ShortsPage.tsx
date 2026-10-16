import { Bookmark, Clapperboard, Heart, MessageCircle, Play, Send, Volume2, VolumeX, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { RepliesPanel } from '../components/RepliesPanel';
import { ErrorState, Loading } from '../components/States';
import type { Page, Post } from '../types';

const sampleShorts: Post[] = [
  ['sea-breeze', 'https://d34w7g4gy10iej.cloudfront.net/video/2507/DOD_111138411/DOD_111138411.mp4', 'Nhịp sống trên biển 🌊', 'Khoảnh khắc đại dương', 'ocean.frames', 128],
  ['explosion', 'https://nimk.openbeelden.nl/files/11/56/1156830.1156827.explosie.mp4', 'Một hiệu ứng hoạt hình vui mắt 💥', 'Góc hoạt hình', 'tiny.frames', 86],
  ['sample-audio', 'https://samplefile.com/samples/download/video/mp4/mp4_h264_aac_360p_sample.mp4/', 'Thử một khung hình mới hôm nay ✨', 'Khoảnh khắc', 'daily.moments', 54],
].map(([id, url, content, display_name, username, likes_count]) => ({
  id: `demo-${id}`, content: String(content),
  author: { id: `demo-${id}`, username: String(username), display_name: String(display_name), role: 'user', status: 'active', is_verified: false, followers_count: 0, following_count: 0, posts_count: 0, replies_count: 0, reposts_count: 0, is_following: false, created_at: new Date().toISOString() },
  media: [{ id: `demo-${id}`, url: String(url), mime_type: 'video/mp4', size_bytes: 0, created_at: new Date().toISOString() }],
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_short: true,
  likes_count: Number(likes_count), replies_count: 0, reposts_count: 0, liked: false, reposted: false, bookmarked: false,
} as Post));

function ShortCard({ initial, demo = false }: { initial: Post; demo?: boolean }) {
  const [post, setPost] = useState(initial);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
        video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        video.pause();
        setPlaying(false);
      }
    }, { threshold: [0, 0.65, 1] });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const toggleVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().then(() => setPlaying(true)).catch(() => null);
    else { video.pause(); setPlaying(false); }
  };

  const toggle = async (kind: 'likes' | 'bookmarks', active: boolean) => {
    const previous = post;
    setPost((current) => ({
      ...current,
      [kind === 'likes' ? 'liked' : 'bookmarked']: !active,
      ...(kind === 'likes' ? { likes_count: current.likes_count + (active ? -1 : 1) } : {}),
    }));
    if (demo) return;
    try { await api(`/posts/${post.id}/${kind}`, { method: active ? 'DELETE' : 'POST' }); }
    catch { setPost(previous); }
  };

  const share = async () => {
    const url = demo ? `${window.location.origin}/shorts` : `${window.location.origin}/posts/${post.id}`;
    if (navigator.share) await navigator.share({ title: `Short của @${post.author.username}`, text: post.content, url }).catch(() => null);
    else await navigator.clipboard.writeText(url);
  };

  const video = post.media[0];
  return (
    <article className="short-card">
      <div className="short-stage">
        <video ref={videoRef} src={video.url} muted={muted} loop playsInline preload="metadata" onClick={toggleVideo} aria-label={`Short của ${post.author.display_name}`} />
        {!playing && <button className="short-play" onClick={toggleVideo} aria-label="Phát video"><Play fill="currentColor" /></button>}
        <div className="short-gradient" />
        <div className="short-copy">
          {demo ? <span className="short-author"><Avatar user={post.author} size={38} /><b>{post.author.username}</b></span> : <Link to={`/${post.author.username}`} className="short-author"><Avatar user={post.author} size={38} /><b>{post.author.username}</b>{post.author.is_verified && <i>✓</i>}</Link>}
          {post.content && <p>{post.content}</p>}
          {demo ? <span className="short-detail-link">Video minh họa</span> : <Link className="short-detail-link" to={`/posts/${post.id}`}>Chi tiết và tùy chọn bài viết</Link>}
        </div>
        <div className="short-actions">
          <button className={post.liked ? 'active-like' : ''} onClick={() => toggle('likes', post.liked)} aria-label="Thích"><Heart fill={post.liked ? 'currentColor' : 'none'} /><span>{post.likes_count || ''}</span></button>
          <button disabled={demo} onClick={() => setRepliesOpen(true)} aria-label="Bình luận" title={demo ? 'Video minh họa chưa hỗ trợ bình luận' : 'Bình luận'}><MessageCircle /><span>{post.replies_count || ''}</span></button>
          <button onClick={share} aria-label="Chia sẻ"><Send /></button>
          <button className={post.bookmarked ? 'active-bookmark' : ''} onClick={() => toggle('bookmarks', post.bookmarked)} aria-label="Lưu"><Bookmark fill={post.bookmarked ? 'currentColor' : 'none'} /></button>
          <button onClick={() => setMuted((current) => !current)} aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'} title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}>{muted ? <VolumeX /> : <Volume2 />}</button>
        </div>
        {repliesOpen && <div className="short-replies">
          <header><b>Bình luận</b><button onClick={() => setRepliesOpen(false)} aria-label="Đóng bình luận"><X /></button></header>
          <RepliesPanel postId={post.id} authorUsername={post.author.username} onCountChange={(change) => setPost((current) => ({ ...current, replies_count: Math.max(0, current.replies_count + change) }))} />
        </div>}
      </div>
    </article>
  );
}

export function ShortsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api<Page<Post>>('/feed/shorts');
      setPosts(data.items);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const addShort = (event: Event) => {
      const post = (event as CustomEvent<Post>).detail;
      if (post.is_short) setPosts((current) => [post, ...current]);
    };
    window.addEventListener('kma:post-created', addShort);
    return () => window.removeEventListener('kma:post-created', addShort);
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={load} />;
  const visiblePosts = posts.length ? posts : sampleShorts;
  return <section className="shorts-page"><div className="shorts-heading"><div><h1>Shorts</h1><p>{posts.length ? 'Video ngắn từ cộng đồng KMAgram' : 'Xem thử video ngắn mẫu'}</p></div><button className="short-create-btn" onClick={() => window.dispatchEvent(new Event('kma:create-short'))}><Clapperboard size={17} /> Tạo short</button></div><div className="shorts-feed">{visiblePosts.map((post) => <ShortCard key={post.id} initial={post} demo={!posts.length} />)}</div></section>;
}
