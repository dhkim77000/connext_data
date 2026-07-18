import { redirect } from 'next/navigation'
import { getConnector } from '@/lib/connectors-meta'
import { ConnectWizard } from '@/components/connect-wizard'

export default async function ConnectPage({
  params,
}: {
  params: Promise<{ connectorId: string }>
}) {
  const { connectorId } = await params
  const info = getConnector(connectorId)
  if (!info) redirect('/channels')

  return (
    <div className="py-2">
      <ConnectWizard info={info} />
    </div>
  )
}
