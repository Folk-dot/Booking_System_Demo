import { Outlet, NavLink, useNavigate } from 'react-router-dom';

const NAV = [
  {
    to: '/bookings',
    label: 'Bookings',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: '/availability',
    label: 'Availability',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export default function Layout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('trainer_user') || '{}');

  function handleLogout() {
    localStorage.removeItem('trainer_token');
    localStorage.removeItem('trainer_user');
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden w-60 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="border-b border-gray-100 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Trainer Portal</p>
          <p className="mt-1 truncate font-semibold text-gray-900">{user.name || 'Trainer'}</p>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition
                 ${isActive
                   ? 'bg-brand-50 text-brand-700'
                   : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
              }
            >
              {n.icon}
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-100 px-3 py-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm
                       font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <p className="font-semibold text-gray-900">{user.name || 'Trainer'}</p>
          <button onClick={handleLogout} className="text-sm text-red-500">Logout</button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="flex border-t border-gray-200 bg-white md:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition
                 ${isActive ? 'text-brand-600' : 'text-gray-500'}`
              }
            >
              {n.icon}
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
