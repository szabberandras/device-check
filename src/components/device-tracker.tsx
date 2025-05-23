import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, Calendar, Clock, MapPin, Upload } from 'lucide-react';
import Papa from 'papaparse';

// Define types for CSV data structure
interface DeviceDataRow {
  'Device Name': string;
  'Last Seen': string;
  'Last Seen On': string;
  'Current location': string;
  'Study': string;
  [key: string]: unknown; // Allow for other columns not explicitly defined
}

// Define the processed device object type for internal state
interface ProcessedDevice {
  deviceName: string;
  lastSeenStr: string;
  lastSeenOn: string;
  location: string;
  study: string;
  lastSeenDate: Date | null;
  hoursSince: number | null;
  category: 'under24h' | 'between24_48h' | 'between48h_5d' | 'over5d' | 'unknown';
  categoryColor: string;
}

const DeviceTracker = () => {
  // Explicitly type the state variables to avoid 'never[]' inference
  const [devices, setDevices] = useState<ProcessedDevice[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<ProcessedDevice[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStudy, setSelectedStudy] = useState<string>('all');
  const [sites, setSites] = useState<string[]>([]);
  const [studies, setStudies] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [stats, setStats] = useState({
    total: 0,
    under24h: 0,
    between24_48h: 0,
    between48h_5d: 0,
    over5d: 0
  });
  const [csvFileName, setCsvFileName] = useState<string>('');

  const statsCardsRef = useRef<HTMLDivElement>(null); // Ref for KPI section for PDF export

  // Explicitly type 'data' parameter as DeviceDataRow[]
  const processDeviceData = useCallback((data: DeviceDataRow[]) => {
    const processedData: ProcessedDevice[] = data.map(row => {
      const deviceName = row['Device Name']?.trim() || '';
      const lastSeenStr = row['Last Seen']?.trim() || '';
      const lastSeenOn = row['Last Seen On']?.trim() || '';
      const location = row['Current location']?.trim() || '';
      const study = row['Study']?.trim() || '';

      let lastSeenDate: Date | null = null;
      if (lastSeenStr) {
        const dateStr = lastSeenStr.replace(' UTC', '');
        lastSeenDate = new Date(dateStr);
      }

      const now = new Date('2025-05-22T06:38:00Z'); // Using fixed date from original context
      const hoursSince = lastSeenDate ? (now.getTime() - lastSeenDate.getTime()) / (1000 * 60 * 60) : null;

      let category: ProcessedDevice['category'] = 'unknown';
      let categoryColor = '#f3f4f6';

      if (hoursSince !== null) {
        if (hoursSince < 24) {
          category = 'under24h';
          categoryColor = '#dcfce7';
        } else if (hoursSince < 48) {
          category = 'between24_48h';
          categoryColor = '#fef3c7';
        } else if (hoursSince < 120) {
          category = 'between48h_5d';
          categoryColor = '#fed7aa';
        } else {
          category = 'over5d';
          categoryColor = '#fecaca';
        }
      }

      return {
        deviceName,
        lastSeenStr,
        lastSeenOn,
        location,
        study,
        lastSeenDate,
        hoursSince,
        category,
        categoryColor
      };
    }).filter(device => device.deviceName);

    setDevices(processedData);

    const uniqueSites = [...new Set(processedData.map(d => d.location).filter(Boolean))].sort();
    setSites(uniqueSites);

    const uniqueStudies = [...new Set(processedData.map(d => d.study).filter(Boolean))].sort();
    setStudies(uniqueStudies);

    const newStats = {
      total: processedData.length,
      under24h: processedData.filter(d => d.category === 'under24h').length,
      between24_48h: processedData.filter(d => d.category === 'between24_48h').length,
      between48h_5d: processedData.filter(d => d.category === 'between48h_5d').length,
      over5d: processedData.filter(d => d.category === 'over5d').length
    };
    setStats(newStats);
  }, []);

  const applyFilters = useCallback(() => {
    let filtered = [...devices];

    if (selectedSite !== 'all') {
      filtered = filtered.filter(device => device.location === selectedSite);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(device => device.category === selectedStatus);
    }

    if (selectedStudy !== 'all') {
      filtered = filtered.filter(device => device.study === selectedStudy);
    }

    if (searchTerm) {
      filtered = filtered.filter(device =>
        device.deviceName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredDevices(filtered);
  }, [devices, selectedSite, selectedStatus, searchTerm, selectedStudy]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    applyFilters();
  }, [devices, selectedSite, selectedStatus, searchTerm]);

  const exportToCSV = () => {
    const dataToExport = filteredDevices.length > 0 ? filteredDevices : devices;
    const csvContent = [
      ['IMEI', 'Last Seen', 'Hours Since', 'Status', 'Location', 'Study'],
      ...dataToExport.map(device => [
        device.deviceName,
        device.lastSeenStr,
        device.hoursSince ? device.hoursSince.toFixed(1) : 'N/A',
        device.category === 'under24h' ? 'Active (< 24h)' :
        device.category === 'between24_48h' ? 'Recent (24-48h)' :
        device.category === 'between48h_5d' ? 'Warning (2-5 days)' :
        device.category === 'over5d' ? 'Critical (> 5 days)' : 'Unknown',
        device.location,
        device.study
      ])
    ];

    const csv = csvContent.map(row => row.map(field => `"${field}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `device_status_report_${selectedSite !== 'all' ? selectedSite.replace(/[^a-zA-Z0-9]/g, '_') : 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportKpiToPDF = async () => { // <--- MODIFIED: Added async
    if (statsCardsRef.current) {
      // Dynamically import html2pdf.js only on the client-side
      const html2pdf = (await import('html2pdf.js')).default; // <--- MODIFIED: Dynamic import

      const element = statsCardsRef.current;
      const opt = {
        margin:       10,
        filename:     'device_kpi_report.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(element).save();
    } else {
      console.error("Statistics cards element not found for PDF export.");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCsvFileName(file.name);
      Papa.parse(file, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
          processDeviceData(results.data as DeviceDataRow[]);
          setSelectedSite('all');
          setSelectedStatus('all');
          setSearchTerm('');
          setSelectedStudy('all');
        },
        error: (err) => {
          console.error('Error parsing CSV:', err);
          alert('Failed to parse CSV file. Please check the file format.');
        }
      });
    }
  };

  const getFilteredStats = () => {
    const filtered = filteredDevices.length > 0 ? filteredDevices : devices;
    return {
      total: filtered.length,
      under24h: filtered.filter(d => d.category === 'under24h').length,
      between24_48h: filtered.filter(d => d.category === 'between24_48h').length,
      between48h_5d: filtered.filter(d => d.category === 'between48h_5d').length,
      over5d: filtered.filter(d => d.category === 'over5d').length
    };
  };

  const getCategoryLabel = (category: ProcessedDevice['category']) => {
    switch (category) {
      case 'under24h': return 'Active (< 24h)';
      case 'between24_48h': return 'Recent (24-48h)';
      case 'between48h_5d': return 'Warning (2-5 days)';
      case 'over5d': return 'Critical (> 5 days)';
      default: return 'Unknown';
    }
  };

  const getCategoryIcon = (category: ProcessedDevice['category']) => {
    switch (category) {
      case 'under24h': return <div className="w-3 h-3 bg-green-500 rounded-full"></div>;
      case 'between24_48h': return <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>;
      case 'between48h_5d': return <div className="w-3 h-3 bg-orange-500 rounded-full"></div>;
      case 'over5d': return <div className="w-3 h-3 bg-red-500 rounded-full"></div>;
      default: return <div className="w-3 h-3 bg-gray-500 rounded-full"></div>;
    }
  };

  const displayDevices = filteredDevices.length > 0 ? filteredDevices : devices;
  const displayStats = getFilteredStats();

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Device Status Dashboard</h1>
        <p className="text-gray-600">Track device activity based on last seen timestamps</p>
      </div>

      {/* CSV Upload Section */}
      <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-blue-900 mb-2">Upload Device Data CSV</h2>
          <p className="text-sm text-blue-800">
            {csvFileName ? `Currently loaded: ${csvFileName}` : 'No CSV file loaded. Please upload one.'}
          </p>
        </div>
        <label htmlFor="csv-upload" className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
          <Upload className="w-4 h-4 mr-2" />
          Upload CSV
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>


      {/* Filters */}
      <div className="mb-8 p-6 bg-gray-50 rounded-lg border">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        {/* Adjusted grid to accommodate new filter for larger screens */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Site/Location</label>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={devices.length === 0}
            >
              <option value="all">All Sites ({sites.length})</option>
              {sites.map(site => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={devices.length === 0}
            >
              <option value="all">All Status</option>
              <option value="under24h">Active (&lt; 24h)</option>
              <option value="between24_48h">Recent (24-48h)</option>
              <option value="between48h_5d">Warning (2-5 days)</option>
              <option value="over5d">Critical (&gt; 5 days)</option>
            </select>
          </div>

          {/* NEW STUDY FILTER DROPDOWN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Study</label>
            <select
              value={selectedStudy}
              onChange={(e) => setSelectedStudy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={devices.length === 0}
            >
              <option value="all">All Studies ({studies.length})</option>
              {studies.map(study => (
                <option key={study} value={study}>{study}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search IMEI</label>
            <input
              type="text"
              placeholder="Enter IMEI to search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={devices.length === 0}
            />
          </div>
        </div>

        {/* Updated Active filters display */}
        {(selectedSite !== 'all' || selectedStatus !== 'all' || searchTerm || selectedStudy) && (
          <div className="mt-4 flex flex-wrap items-center space-x-2">
            <span className="text-sm text-gray-600">Active filters:</span>
            {selectedSite !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                Site: {selectedSite}
                <button
                  onClick={() => setSelectedSite('all')}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >×</button>
              </span>
            )}
            {selectedStatus !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                Status: {getCategoryLabel(selectedStatus as ProcessedDevice['category'])}
                <button
                  onClick={() => setSelectedStatus('all')}
                  className="ml-1 text-green-600 hover:text-green-800"
                >×</button>
              </span>
            )}
            {selectedStudy !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                Study: {selectedStudy}
                <button
                  onClick={() => setSelectedStudy('all')}
                  className="ml-1 text-purple-600 hover:text-purple-800"
                >×</button>
              </span>
            )}
            {searchTerm && (
              <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                IMEI: {searchTerm}
                <button
                  onClick={() => setSearchTerm('')}
                  className="ml-1 text-yellow-600 hover:text-yellow-800"
                >×</button>
              </span>
            )}
            <button
              onClick={() => {
                setSelectedSite('all');
                setSelectedStatus('all');
                setSearchTerm('');
                setSelectedStudy('all');
              }}
              className="text-sm text-red-600 hover:text-red-800 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div ref={statsCardsRef} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Devices</p>
              <p className="text-2xl font-bold text-blue-900">{displayStats.total}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Active (&lt; 24h)</p>
              <p className="text-2xl font-bold text-green-900">{displayStats.under24h}</p>
            </div>
            <div className="w-8 h-8 bg-green-500 rounded-full"></div>
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">Recent (24-48h)</p>
              <p className="text-2xl font-bold text-yellow-900">{displayStats.between24_48h}</p>
            </div>
            <div className="w-8 h-8 bg-yellow-500 rounded-full"></div>
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Warning (2-5d)</p>
              <p className="text-2xl font-bold text-orange-900">{displayStats.between48h_5d}</p>
            </div>
            <div className="w-8 h-8 bg-orange-500 rounded-full"></div>
          </div>
        </div>

        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Critical (&gt; 5d)</p>
              <p className="text-2xl font-bold text-red-900">{displayStats.over5d}</p>
            </div>
            <div className="w-8 h-8 bg-red-500 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="mb-6 flex space-x-4">
        <button
          onClick={exportToCSV}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          disabled={devices.length === 0}
        >
          <Download className="w-4 h-4 mr-2" />
          Export Filtered Data ({displayDevices.length} devices)
        </button>

        {/* PDF Export Button */}
        <button
          onClick={exportKpiToPDF}
          className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          disabled={devices.length === 0}
        >
          <Download className="w-4 h-4 mr-2" />
          Export KPI to PDF
        </button>
      </div>

      {/* Excel Formatting Instructions */}
      <div className="mb-8 p-6 bg-gray-50 rounded-lg border">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Excel Conditional Formatting Instructions</h2>
        <div className="space-y-3 text-sm">
          <p className="font-medium text-gray-800">To apply this formatting in Excel:</p>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Select your data range (including headers)</li>
            <li>Go to Home → Conditional Formatting → New Rule</li>
            <li>Choose "Use a formula to determine which cells to format"</li>
            <li>Create these rules (assuming data starts in row 2 and "Last Seen" is in column B):</li>
          </ol>
          <div className="mt-4 space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-green-200 border border-green-400 rounded"></div>
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">{"=(NOW()-B2)*24<24"}</code>
              <span className="text-green-700 font-medium">Active (&lt; 24h)</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-yellow-200 border border-yellow-400 rounded"></div>
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">{"=AND((NOW()-B2)*24>=24,(NOW()-B2)*24<48)"}</code>
              <span className="text-yellow-700 font-medium">Recent (24-48h)</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-orange-200 border border-orange-400 rounded"></div>
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">{"=AND((NOW()-B2)*24>=48,(NOW()-B2)*24<120)"}</code>
              <span className="text-orange-700 font-medium">Warning (2-5 days)</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-red-200 border border-red-400 rounded"></div>
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">{"=(NOW()-B2)*24>=120"}</code>
              <span className="text-red-700 font-medium">Critical (&gt; 5 days)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Device Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Device Status List</h2>
            <span className="text-sm text-gray-600">
              Showing {Math.min(displayDevices.length, 100)} of {displayDevices.length} devices
              {(selectedSite !== 'all' || selectedStatus !== 'all' || searchTerm || selectedStudy) &&
                ` (filtered from ${devices.length} total)`
              }
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IMEI</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Seen</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours Since</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Study</th> {/* <--- ADDED: Table header for Study */}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayDevices.slice(0, 100).map((device, index) => (
                <tr key={index} style={{ backgroundColor: device.categoryColor }}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(device.category)}
                      <span className="text-sm font-medium text-gray-900">
                        {getCategoryLabel(device.category)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {device.deviceName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>{device.lastSeenStr}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {device.hoursSince ? `${device.hoursSince.toFixed(1)}h` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{device.location}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"> {/* <--- ADDED: Table cell for Study */}
                    <span>{device.study || 'N/A'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {displayDevices.length > 100 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing first 100 of {displayDevices.length} filtered devices. Export to CSV to see all data.
            </p>
          </div>
        )}
        {displayDevices.length === 0 && (
          <div className="px-6 py-8 text-center">
            <p className="text-gray-500">No devices to display. Please upload a CSV file.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceTracker;