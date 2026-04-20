export default function LoadingSpinner({ text = 'กำลังโหลด...' }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}
