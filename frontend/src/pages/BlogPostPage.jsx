import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, Clock, Tag, ArrowRight, BookOpen, ChevronRight } from 'lucide-react';
import DOMPurify from 'dompurify';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import { getPostBySlug, getRelatedPosts } from '../blog/posts/index';
import { useI18n } from '../lib/i18n';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function ValuationCTA({ isDark }) {
  const { t } = useI18n();
  return (
    <div className={`my-10 rounded-2xl border p-6 md:p-8 ${isDark ? 'bg-gradient-to-br from-emerald-900/30 to-slate-900 border-emerald-800/30' : 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200'}`}>
      <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mb-4 ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
        <BookOpen className="w-3.5 h-3.5" /> {t('blog_post_val_cta_badge')}
      </div>
      <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {t('blog_post_val_cta_title')}
      </h3>
      <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {t('blog_post_val_cta_desc')}
      </p>
      <Link
        to="/register"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition shadow-lg shadow-emerald-900/20"
      >
        {t('blog_post_val_cta_button')} <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function PitchDeckCTA({ isDark }) {
  const { t } = useI18n();
  return (
    <div className={`my-10 rounded-2xl border p-6 md:p-8 ${isDark ? 'bg-gradient-to-br from-purple-900/30 to-slate-900 border-purple-800/30' : 'bg-gradient-to-br from-purple-50 to-white border-purple-200'}`}>
      <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mb-4 ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
        <BookOpen className="w-3.5 h-3.5" /> {t('blog_post_pitch_cta_badge')}
      </div>
      <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {t('blog_post_pitch_cta_title')}
      </h3>
      <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {t('blog_post_pitch_cta_desc')}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/register"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-purple-600 hover:bg-purple-500 text-white text-sm transition shadow-lg shadow-purple-900/20"
        >
          {t('blog_post_pitch_cta_button')} <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          to="/register"
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition border ${isDark ? 'border-slate-700 text-slate-300 hover:border-emerald-600 hover:text-emerald-400' : 'border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700'}`}
        >
          {t('blog_post_pitch_cta_secondary')}
        </Link>
      </div>
    </div>
  );
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const { isDark } = useTheme();
  const { t, locale } = useI18n();
  const post = getPostBySlug(slug);

  usePageTitle(post ? post.title : t('blog_post_not_found'));

  if (!post) return <Navigate to="/blog" replace />;

  const related = getRelatedPosts(slug, 3);
  const CTA = post.ctaType === 'pitch-deck' ? PitchDeckCTA : ValuationCTA;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-colors duration-300 ${isDark ? 'bg-slate-950/80 border-slate-800/50' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-4xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/blog" className={`flex items-center gap-1.5 text-sm transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Blog</span>
            </Link>
            <span className={`hidden sm:inline ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>/</span>
            <span className={`hidden sm:inline text-sm truncate max-w-[200px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{post.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-1.5">
              <img src="/favicon.svg?v=2" alt="QV" className="w-7 h-7" />
              <span className={`font-bold text-sm hidden sm:inline ${isDark ? 'text-white' : 'text-slate-900'}`}>Valuora</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Article */}
      <article className="pt-28 pb-16 max-w-3xl mx-auto px-6">
        {/* Breadcrumb */}
        <nav className={`flex items-center gap-1.5 text-xs mb-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <Link to="/" className="hover:text-emerald-500 transition">{t('blog_post_breadcrumb_home')}</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/blog" className="hover:text-emerald-500 transition">{t('blog_post_breadcrumb_blog')}</Link>
          <ChevronRight className="w-3 h-3" />
          <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{post.category}</span>
        </nav>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
            post.category === 'Pitch Deck'
              ? (isDark ? 'text-purple-400 bg-purple-400/10 border-purple-400/20' : 'text-purple-700 bg-purple-50 border-purple-200')
              : (isDark ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-emerald-700 bg-emerald-50 border-emerald-200')
          }`}>
            <Tag className="w-3 h-3" />{post.category}
          </span>
          <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <Clock className="w-3 h-3" />{t('blog_post_read_time', { time: post.readTime })}
          </span>
          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {formatDate(post.date)}
          </span>
        </div>

        {/* Title */}
        <h1 className={`text-3xl md:text-4xl font-extrabold tracking-tight leading-tight mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {post.title}
        </h1>

        {/* Description lead */}
        <p className={`text-lg leading-relaxed mb-8 border-l-4 pl-4 ${isDark ? 'text-slate-300 border-emerald-600' : 'text-slate-600 border-emerald-400'}`}>
          {post.description}
        </p>

        {/* CTA — top */}
        <CTA isDark={isDark} />

        {/* Content */}
        <div
          className={`prose max-w-none blog-content ${isDark ? 'prose-invert' : ''}`}
          style={{
            '--tw-prose-body': isDark ? '#94a3b8' : '#475569',
            '--tw-prose-headings': isDark ? '#f1f5f9' : '#0f172a',
            '--tw-prose-bold': isDark ? '#e2e8f0' : '#1e293b',
            '--tw-prose-links': '#10b981',
          }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
        />

        {/* CTA — bottom */}
        <CTA isDark={isDark} />

        {/* Share prompt */}
        <div className={`mt-10 pt-8 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('blog_post_share_prompt')}
          </p>
        </div>
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section className={`border-t py-16 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'}`}>
          <div className="max-w-5xl mx-auto px-6">
            <h2 className={`text-xl font-bold mb-8 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('blog_post_related_title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {related.map(rp => (
                <Link
                  key={rp.slug}
                  to={`/blog/${rp.slug}`}
                  className={`group rounded-xl border p-5 transition hover:-translate-y-0.5 ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white'}`}
                >
                  <span className={`text-xs font-medium ${rp.category === 'Pitch Deck' ? 'text-purple-500' : 'text-emerald-500'}`}>
                    {rp.category}
                  </span>
                  <h3 className={`mt-2 text-sm font-semibold leading-snug group-hover:text-emerald-500 transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {rp.title}
                  </h3>
                  <div className="flex items-center gap-1 mt-3 text-xs text-emerald-500 font-medium">
                    {t('blog_post_read')} <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
