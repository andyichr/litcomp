#!/usr/bin/env perl

use FileHandle;
use IPC::Open2;

use JSON;
use Data::Dumper;

use strict;

my @input = <STDIN>;
my $req = from_json( join( "", @input ) );

my $error = sub {
	my $message = shift;
	print STDERR "ERROR: $message";
	print STDERR "\n";
	exit 1;
};

# build shell pipeline given request
my @path = split ( ":", $ENV{PATH} );
sub pipeline_cmd {
	my $req = shift;
	my $emit_param = shift;
	my $emit_intermediate_result = shift;
	my $cmd;
	my $type;

	if ( ref( $req ) eq "ARRAY" ) {
		$type = $req->[0];
	}

	if ( $type eq "map" ) {
		my $parameter = $req->[2];
		my $map_name = $req->[1];
		my $param_domain;
		my $param_codomain;

		my $param_cmd = pipeline_cmd( $parameter, $emit_param, sub {
			my %res = @_;
			$param_domain = $res{domain};
			$param_codomain = $res{codomain};
		} );

		my @map_parts = split( " : ", $map_name );
		my $map_function = $map_parts[0];
		my @domain_parts = split( " -> ", $map_parts[1] );
		my $domain = $domain_parts[0];
		my $codomain = $domain_parts[1];

		if ( $domain eq "_" && $param_codomain ne "_" ) {
			$domain = $param_codomain;
		}

		if ( $codomain eq "_" && $param_domain ne "_" ) {
			$codomain = $param_domain;
		}

		my $found_arrow = 0;
		my $arrow_bin;

		foreach ( @path ) {
			my $base_dir = $_;
			$arrow_bin = $base_dir . "/" . $domain . "/" . $codomain . "/" . $map_function;

			if ( -e $arrow_bin ) {
				$found_arrow = 1;
				last;
			}
		}

		if ( !$found_arrow ) {
			$error->( "arrow not found: $map_function : $domain -> $codomain" );
		}

		if ( $param_cmd ) {
			my @param_cmd_lines = split( "\n", $param_cmd );
			$param_cmd_lines[0] .= " | " . $arrow_bin;
			$cmd = join( "\n", @param_cmd_lines );
		} else {
			$cmd = $arrow_bin;
		}

		if ( $emit_intermediate_result ) {
			$emit_intermediate_result->(
				domain => $domain,
				codomain => $codomain
			);
		}
	} else {
		if ( $emit_param ) {
			$emit_param->( to_json $req );
		}
	}

	return $cmd;
};

my $param;
my $cmd = pipeline_cmd( $req, sub { $param = shift; } );
my $pid = open2( *Reader, *Writer, $cmd );
print Writer $param;
close( Writer );

while ( my $line = <Reader> ) {
	print $line;
}

close( Reader );
