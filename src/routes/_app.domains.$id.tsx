import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getDomainDetails } from '@/server/domains';
import { Globe, Server, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/domains/$id')({
  component: DomainDetailsPage,
});

function DomainDetailsPage() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['domain', id],
    queryFn: () => getDomainDetails({ data: { id } }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const domain = (data as any)?.domain;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = (data as any)?.records ?? [];

  if (isLoading) {
    return <div className='flex justify-center py-20'><Loader2 className='h-8 w-8 animate-spin text-gray-400' /></div>;
  }

  if (!domain) {
    return (
      <div className='flex flex-col items-center justify-center py-20'>
        <AlertCircle className='h-12 w-12 text-red-500 mb-4' />
        <h2 className='text-xl font-bold'>Domain not found</h2>
        <Link to='/domains' className='text-blue-500 hover:underline mt-2'>Back to Domains</Link>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-6 p-8'>
      <div className='flex items-center gap-4'>
        <Link to='/domains'>
          <div className='flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 hover:bg-gray-50 transition-colors'>
            <ArrowLeft className='h-5 w-5 text-gray-600' />
          </div>
        </Link>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>{domain.name}</h1>
          <div className='flex items-center gap-2 mt-1'>
            <span className='px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100'>
              {domain.status}
            </span>
          </div>
        </div>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col gap-4'>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <Server className='h-5 w-5 text-gray-500' /> Assigned Server
          </h2>
          {domain.server ? (
            <div className='flex items-center gap-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100'>
                <Server className='h-5 w-5 text-purple-600' />
              </div>
              <div>
                <div className='font-medium'>{domain.server.label}</div>
                <div className='text-sm text-gray-500'>{domain.server.ipAddress}</div>
              </div>
            </div>
          ) : (
            <div className='text-sm text-gray-500 italic'>No server assigned yet.</div>
          )}
        </div>

        <div className='rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col gap-4'>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <Globe className='h-5 w-5 text-gray-500' /> DNS Records
          </h2>
          {records.length > 0 ? (
            <div className='space-y-3'>
              {records.map((record: any) => (
                <div key={record.id} className='flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2'>
                  <div className='text-sm font-medium text-slate-600'>{record.type}</div>
                  <div className='font-mono text-sm'>{record.name === '@' ? domain.name : `${record.name}.${domain.name}`}</div>
                  <div className='ml-auto text-sm text-slate-500'>{record.content}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-sm text-gray-500 italic'>No DNS records generated yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}