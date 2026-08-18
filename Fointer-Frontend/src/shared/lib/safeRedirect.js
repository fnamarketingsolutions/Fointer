export const getSafeReturnPath = (from) => {

  let path = null;



  if (typeof from === 'string') {

    path = from;

  } else if (from && typeof from === 'object' && typeof from.pathname === 'string') {

    path = from.pathname;

  }



  if (!path) return null;



  // Strip query/hash; only navigate by pathname.

  const bare = path.split('?')[0].split('#')[0].trim();



  if (!bare.startsWith('/')) return null;

  if (bare.startsWith('//')) return null;

  if (bare.includes('\\')) return null;

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(bare)) return null;

  if (!/^\/[A-Za-z0-9/_-]*$/.test(bare)) return null;



  // Don't bounce users back to auth screens after login.

  if (bare === '/login' || bare === '/signup') return null;



  // `/post` also covers `/posts/:id` and `/post-management`.

  const allowed =

    bare === '/' ||

    bare.startsWith('/admin') ||

    bare.startsWith('/communities') ||

    bare.startsWith('/manage-community') ||

    bare.startsWith('/live-events') ||

    bare.startsWith('/watch-groups') ||

    bare.startsWith('/my-activity') ||

    bare.startsWith('/support') ||

    bare.startsWith('/profile') ||

    bare.startsWith('/notifications') ||

    bare.startsWith('/post');



  return allowed ? bare : null;

};