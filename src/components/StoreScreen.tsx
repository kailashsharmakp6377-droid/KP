import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Category, Course } from '@/src/types';
import { CourseCard } from './CourseCard';

interface StoreScreenProps {
  courses: Course[];
  categories: Category[];
  purchasedCourseIds: string[];
  onViewCourse: (courseId: string) => void;
  onBuyCourse: (courseId: string) => void;
  onOpenPlayer: (courseId: string) => void;
}

export function StoreScreen({
  courses,
  categories,
  purchasedCourseIds,
  onViewCourse,
  onBuyCourse,
  onOpenPlayer,
}: StoreScreenProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'latest' | 'price-low' | 'price-high'>('latest');

  const purchasedSet = useMemo(() => new Set(purchasedCourseIds), [purchasedCourseIds]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = courses.filter((c) => {
      const catOk = selectedCategory === 'all' || c.categoryId === selectedCategory;
      const qOk =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.categoryName.toLowerCase().includes(q);
      return catOk && qOk;
    });

    const getEffective = (c: Course) => (c.discountPrice !== null ? c.discountPrice : c.price);
    if (sortBy === 'price-low') return [...list].sort((a, b) => getEffective(a) - getEffective(b));
    if (sortBy === 'price-high') return [...list].sort((a, b) => getEffective(b) - getEffective(a));
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [courses, search, selectedCategory, sortBy]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-6">
        <div>
          <p className="font-mono text-xs font-semibold text-[#4F46E5]">KP HUBE MARKETPLACE</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-slate-900">Course Store</h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse all KP HUBE courses starting at ₹499 and unlock instant access.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search store..."
              className="h-10 w-full sm:w-64 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#4F46E5] focus:outline-none"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'latest' | 'price-low' | 'price-high')}
            aria-label="Sort courses"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#4F46E5] focus:outline-none"
          >
            <option value="latest">Latest Releases</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            selectedCategory === 'all'
              ? 'bg-[#4F46E5] text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900'
          }`}
        >
          All ({courses.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === cat.id
                ? 'bg-[#4F46E5] text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-base font-medium text-slate-900">No courses matched your filter.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSelectedCategory('all');
            }}
            className="mt-4 min-h-[40px] rounded-xl bg-[#4F46E5] px-4 py-2 text-xs font-semibold text-white"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {results.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              isPurchased={purchasedSet.has(course.id)}
              onViewDetails={onViewCourse}
              onBuyNow={onBuyCourse}
              onOpenPlayer={onOpenPlayer}
            />
          ))}
        </div>
      )}
    </div>
  );
}
