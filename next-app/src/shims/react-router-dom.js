'use client';

/**
 * Compatibility shim for Vite pages that import react-router-dom.
 * Maps to Next.js App Router navigation APIs so Batch 3 pages can relocate
 * with minimal source changes.
 */

import React, { useEffect, useMemo } from 'react';
import NextLink from 'next/link';
import {
  useRouter,
  usePathname,
  useSearchParams as useNextSearchParams,
  useParams as useNextParams,
} from 'next/navigation';

/** Link: accept `to` (RR) or `href` (Next). */
export const Link = React.forwardRef(function ShimLink(
  { to, href, replace, children, ...rest },
  ref
) {
  const target = href ?? to ?? '/';
  return (
    <NextLink ref={ref} href={target} replace={replace} {...rest}>
      {children}
    </NextLink>
  );
});

export function useNavigate() {
  const router = useRouter();
  return (to, options = {}) => {
    if (typeof to === 'number') {
      if (to < 0) router.back();
      else router.forward();
      return;
    }
    const path =
      typeof to === 'string'
        ? to
        : `${to.pathname || ''}${to.search || ''}${to.hash || ''}`;
    if (options.replace) router.replace(path);
    else router.push(path);
  };
}

export function useLocation() {
  const pathname = usePathname() || '/';
  const searchParams = useNextSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : '';
  return useMemo(
    () => ({
      pathname,
      search,
      hash: typeof window !== 'undefined' ? window.location.hash : '',
      state: null,
      key: 'default',
    }),
    [pathname, search]
  );
}

/** RR returns [URLSearchParams, setSearchParams]; Next only has read. */
export function useSearchParams() {
  const params = useNextSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const setSearchParams = (nextInit, navigateOpts = {}) => {
    const next =
      typeof nextInit === 'function' ? nextInit(new URLSearchParams(params)) : nextInit;
    const usp =
      next instanceof URLSearchParams ? next : new URLSearchParams(next);
    const qs = usp.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (navigateOpts.replace) router.replace(url);
    else router.push(url);
  };

  return [params, setSearchParams];
}

export function useParams() {
  return useNextParams() || {};
}

export function Navigate({ to, replace = false }) {
  const router = useRouter();
  useEffect(() => {
    const path = typeof to === 'string' ? to : to?.pathname || '/';
    if (replace) router.replace(path);
    else router.push(path);
  }, [to, replace, router]);
  return null;
}

export function Outlet() {
  return null;
}

export function useOutlet() {
  return null;
}
