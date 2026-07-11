import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock, Tag } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import { useTranslation } from 'react-i18next';
import { getAllPosts } from '../blog/posts/index';

const CATEGORY_COLORS = {
  Valuation: { dark: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', light: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  'Pitch Deck': { dark: 'text-purple-400 bg-purple-400/10 border-purple-400/20', light: 'text-purple-700 bg-purple-50 border-purple-200' },
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlogListPage() {
  const { t, i18n } = useTranslation();
  usePageTitle(t('blog_list_title'));
  const { isDark } = useTheme();
  const locale = i18n.language?.startsWith('en') ? 'en' : 'pt';
  const posts = getAllPosts(locale);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-colors duration-300 ${isDark ? 'bg-slate-950/80 border-slate-800/50' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/favicon.svg?v=2" alt="Valuora" className="w-7 h-7" />
            <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Valuora</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/register"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition"
            >
              Fazer Valuation
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="pt-28 pb-14 md:pt-36 md:pb-18 relative">
        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-b from-emerald-600/5 to-transparent' : 'bg-gradient-to-b from-emerald-50 to-transparent'}`} />
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6 border ${isDark ? 'bg-slate-800/80 border-slate-700/50 text-slate-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            <BookOpen className="w-3.5 h-3.5" />
            {t('blog_list_badge')}
          </div>
          <h1 className={`text-3xl md:text-5xl font-extrabold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('blog_list_heading')}
          </h1>
          <p className={`text-base md:text-lg max-w-2xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('blog_list_subtitle')}
          </p>
        </div>
      </div>

      {/* Posts Grid */}
      <div className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map(post => {
            const catColors = CATEGORY_COLORS[post.category] || CATEGORY_COLORS['Valuation'];
            return (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className={`group flex flex-col rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                  isDark
                    ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:shadow-emerald-900/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-slate-200'
                }`}
              >
                {/* Card top accent */}
                <div className={`h-1 w-full ${post.category === 'Pitch Deck' ? 'bg-gradient-to-r from-purple-500 to-violet-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`} />

                <div className="flex flex-col flex-1 p-6">
                  {/* Category + read time */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${isDark ? catColors.dark : catColors.light}`}>
                      <Tag className="w-3 h-3" />
                      {post.category}
                    </span>
                    <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      <Clock className="w-3 h-3" />
                      {post.readTime}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className={`text-base font-bold leading-snug mb-3 flex-1 group-hover:text-emerald-500 transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {post.title}
                  </h2>

                  {/* Description */}
                  <p className={`text-sm leading-relaxed mb-5 line-clamp-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {post.description}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-dashed ${isDark ? 'border-slate-800' : 'border-slate-100'}">
                    <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                      {formatDate(post.date)}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-500 group-hover:gap-2 transition-all">
                      {t('blog_list_read_article')} <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className={`mt-16 rounded-2xl border p-8 md:p-12 text-center ${isDark ? 'bg-gradient-to-br from-emerald-900/30 to-slate-900/80 border-emerald-800/30' : 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200'}`}>
          <h2 className={`text-2xl md:text-3xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('blog_list_cta_title')}
          </h2>
          <p className={`text-base mb-6 max-w-xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('blog_list_cta_subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition text-sm shadow-lg shadow-emerald-900/30"
            >
              {t('blog_list_cta_valuation')} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/register"
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition border ${
                isDark
                  ? 'border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {t('blog_list_cta_pitch_deck')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
