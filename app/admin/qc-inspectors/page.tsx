import { listQCInspectors } from './actions'
import QCInspectorsClient from './QCInspectorsClient'

export const dynamic = 'force-dynamic'

export default async function QCInspectorsPage() {
  const inspectors = await listQCInspectors()
  return <QCInspectorsClient initialInspectors={inspectors} />
}
