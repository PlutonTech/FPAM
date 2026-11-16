import ReportsQueue from './ReportsQueue';

export default function ReportsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div><h1 className="page-title">Public reports</h1>
          <div className="page-sub">Problems reported by members of the public who scanned an asset's QR label</div></div>
      </header>
      <ReportsQueue />
    </div>
  );
}
