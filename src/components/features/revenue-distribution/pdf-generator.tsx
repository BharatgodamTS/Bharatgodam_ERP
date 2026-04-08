import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatCurrency } from '@/lib/distribution-engine';
import { RevenueDistributionData } from '@/lib/revenue-types';

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 12,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #2563eb',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 10,
  },
  period: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  summarySection: {
    marginBottom: 30,
    padding: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 5,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#0f172a',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    padding: 10,
    marginHorizontal: 5,
    backgroundColor: 'white',
    borderRadius: 3,
    border: '1 solid #e2e8f0',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  table: {
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderBottom: '1 solid #cbd5e1',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1 solid #e2e8f0',
  },
  tableCell: {
    flex: 1,
    fontSize: 10,
  },
  tableHeaderCell: {
    fontWeight: 'bold',
    color: '#0f172a',
  },
  warehouseName: {
    fontWeight: 'bold',
  },
  currency: {
    textAlign: 'right',
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: '1 solid #e2e8f0',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 10,
    color: '#64748b',
  },
  generatedAt: {
    marginTop: 10,
    fontSize: 8,
    color: '#94a3b8',
  },
});

// PDF Document Component
const DistributionReportDocument = ({ data }: { data: RevenueDistributionData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Revenue Distribution Report</Text>
        <Text style={styles.subtitle}>WMS Pro - Monthly Settlement Statement</Text>
        <Text style={styles.period}>
          {data.month} {data.year}
        </Text>
      </View>

      {/* Summary Section */}
      <View style={styles.summarySection}>
        <Text style={styles.summaryTitle}>Financial Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Global Revenue</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.totalGlobalRevenue)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Operator Commission</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.totalOperatorCommission)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Active Warehouses</Text>
            <Text style={styles.summaryValue}>{data.warehouses.length}</Text>
          </View>
        </View>
      </View>

      {/* Revenue Distribution Table */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderCell]}>Warehouse</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell]}>Owner</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell]}>Equity</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, styles.currency]}>Total Revenue</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, styles.currency]}>Owner Share (60%)</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, styles.currency]}>Operator Share (40%)</Text>
        </View>

        {data.warehouses.map((warehouse, index) => (
          <View key={warehouse.warehouseId} style={styles.tableRow}>
            <Text style={styles.tableCell}>
              <Text style={styles.warehouseName}>{warehouse.warehouseName}</Text>
            </Text>
            <Text style={styles.tableCell}>{warehouse.ownerName}</Text>
            <Text style={styles.tableCell}>{warehouse.ownerEquity}%</Text>
            <Text style={[styles.tableCell, styles.currency]}>{formatCurrency(warehouse.totalRevenue)}</Text>
            <Text style={[styles.tableCell, styles.currency]}>{formatCurrency(warehouse.ownerShare)}</Text>
            <Text style={[styles.tableCell, styles.currency]}>{formatCurrency(warehouse.operatorShare)}</Text>
          </View>
        ))}

        {/* Total Row */}
        <View style={[styles.tableRow, { backgroundColor: '#f8fafc', borderTop: '2 solid #cbd5e1' }]}>
          <Text style={[styles.tableCell, styles.warehouseName]}>TOTAL DISTRIBUTION</Text>
          <Text style={styles.tableCell}></Text>
          <Text style={styles.tableCell}></Text>
          <Text style={[styles.tableCell, styles.currency, styles.warehouseName]}>
            {formatCurrency(data.warehouses.reduce((sum, w) => sum + w.totalRevenue, 0))}
          </Text>
          <Text style={[styles.tableCell, styles.currency, styles.warehouseName]}>
            {formatCurrency(data.warehouses.reduce((sum, w) => sum + w.ownerShare, 0))}
          </Text>
          <Text style={[styles.tableCell, styles.currency, styles.warehouseName]}>
            {formatCurrency(data.warehouses.reduce((sum, w) => sum + w.operatorShare, 0))}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          This report is generated automatically by WMS Pro for monthly settlement purposes.
        </Text>
        <Text style={styles.footerText}>
          Revenue distribution is calculated based on 60% owner equity and 40% platform operator share.
        </Text>
        <Text style={styles.generatedAt}>
          Generated on {new Date().toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
    </Page>
  </Document>
);

/**
 * Generates and downloads a PDF distribution report
 */
export async function generateDistributionReport(data: RevenueDistributionData): Promise<void> {
  try {
    const blob = await pdf(<DistributionReportDocument data={data} />).toBlob();

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `revenue-distribution-${data.month.toLowerCase()}-${data.year}.pdf`;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating PDF report:', error);
    throw new Error('Failed to generate distribution report');
  }
}